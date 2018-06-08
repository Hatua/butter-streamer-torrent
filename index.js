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
  }

  initialize (source, options) {
    this._client = new WebTorrent()

    return new Promise((resolve, reject) => {
      const onReady = (torrent) => {
        this._torrent = torrent
        this.name = torrent.name

        debug('torrent ready')
        resolve(torrent.files.sort((a, b) => b.length - a.length ))
      }

      this._client.add(source, torrent => {
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

  destroy () {
    super.destroy()

    if (this._torrent) this._torrent.destroy()
    if (this._client) this._client.destroy()

    this._file = null
    this._torrent = null
    this._client = null
  }
}

TorrentStreamer.config = config

module.exports = TorrentStreamer
