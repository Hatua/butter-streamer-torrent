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
  constructor (source, options = {}) {
    super(options, config)

    this._client = new WebTorrent()

    const onReady = (torrent) => {
      debug('torrent ready')
      this._file = options.index ? torrent.files[index] : torrent.files.reduce((file, cur) => (
        cur.length > file.length ? cur: file
      ), {length: 0})

      this._file.select()

      this.ready(this._file.createReadStream(), {length: this._file.length})
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

      torrent.on('download', bytes => {
//        debug('progress: ' + torrent.progress)
      })

      torrent.on('done', () => debug('TORRENT DONE'))
    })
  }

  seek (start, end = 0) {
    if (this._destroyed) throw new ReferenceError('Streamer already destroyed')
    if (!this._ready) return

    var opts = {
      start: start
    }

    if (end) {
      opts.end = end
    }

    debug('seek', opts)
    this.reset(this._file.createReadStream(opts), {
      length: this._file.length - start
    })
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
