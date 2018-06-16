const WebTorrent = require('webtorrent')
const crypto = require('crypto')
const debug = require('debug')('butter-streamer-torrent')
const deepEqual = require('deep-equal')

const Streamer = require('butter-streamer')
const config = {
  name: 'Torrents and Magnet Links Streamer',
  suffix: /(torrent)/,
  protocol: /(torrent|magnet)/,
  type: 'torrent',
  priority: 50
}

const statsKeys = [
  'timeRemaining',
  'downloaded',
  'downloadSpeed',
  'uploadSpeed',
  'progress',
  'ratio',
  'numPeers'
]

/* -- Torrent Streamer -- */
class TorrentStreamer extends Streamer {
  constructor (source, options) {
    super(source, options, config)
  }

  get stats () {
    return statsKeys.reduce((acc, key) => Object.assign(acc, {
      [key]: this[key]
    }), {})
  }

  get timeRemaining() { return this._torrent.timeRemaining}
  get downloaded() { return this._torrent.downloaded}
  get downloadSpeed() { return this._torrent.downloadSpeed}
  get uploadSpeed() { return this._torrent.uploadSpeed}
  get progress() { return this._torrent.progress}
  get ratio() { return this._torrent.ratio}
  get numPeers() { return this._torrent.numPeers}

  initialize (source, options) {
    this._client = new WebTorrent()

    return new Promise((resolve, reject) => {
      const onReady = (torrent) => {
        this._torrent = torrent
        this.name = torrent.name

        if (this._interval) clearInterval(this._interval)
        let oldStats = this.stats

        this._interval = setInterval(() => {
          if (deepEqual(this.stats, oldStats) || this.stats.downloaded === 0) return

          oldStats = this.stats
          debug('progress', this.stats)
          this.emit('progress', this.stats)
        }, 200)

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
    if (this._interval) clearInterval(this._interval)

    this._file = null
    this._torrent = null
    this._client = null
  }
}

TorrentStreamer.config = config

module.exports = TorrentStreamer
