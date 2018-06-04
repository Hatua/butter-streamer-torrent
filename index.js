const WebTorrent = require('webtorrent')
const crypto = require('crypto')
const debug = require('debug')('butter-streamer-torrent')

const Streamer = require('butter-streamer')
const config = {
  name: 'Torrents and Magnet Links Streamer',
  suffix: /(torrent)/,
  protocol: /(torrent|magnet)/,
  type: 'torrent',
  priority: 50
}

/* -- Torrent Streamer -- */
class TorrentStreamer extends Streamer {
  constructor (source, options) {
    super(source, options, config)

    this._client = new WebTorrent()

    this.readyPromise = new Promise((accept, reject) => {
      const onReady = (torrent) => {
        debug('torrent ready')

        if (options.index) {
          this._file = torrent.files[options.index]
        }

        if (! this._file) {
          this._file = torrent.files.reduce((file, cur) => (
            cur.length > file.length ? cur: file), {length: 0}
          )
        }

        this._file.select()

        accept(this._file)
      }

      this._client.add(source, torrent => {
        debug('got torrent', torrent)
        this._torrent = torrent
        torrent._selections = [] // HACK https://github.com/webtorrent/webtorrent/issues/164

        if (torrent.ready) {
          onReady(torrent)
        } else {
          torrent.on('ready', () => onReady(torrent))
        }
      })
    })
  }

  createStream(source, opts) {
    return this.readyPromise
               .then(file => ({
                 stream: file.createReadStream(opts),
                 length: file.length - opts.start
               }))
  }

  destroy () {
    super.destroy()

    if (this._file) this._file.deselect()
    if (this._torrent) this._torrent.destroy()
    if (this._client) this._client.destroy()

    this._file = null
    this._torrent = null
    this._client = null
  }
}

TorrentStreamer.config = config

module.exports = TorrentStreamer
