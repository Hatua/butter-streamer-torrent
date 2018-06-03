const torrentStream = require('torrent-stream')
const readTorrent = require('read-torrent')
const crypto = require('crypto')

const Streamer = require('butter-base-streamer')
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
    super(options)
    this.config = config
    options = options || {}

    if (options.torrent &&
        options.torrent.id &&
        options.torrent.id.length < 20) {
      var idRemainder = 20 - options.torrent.id.length
      var remainderHash = crypto.createHash('sha1')
                                .update(crypto.pseudoRandomBytes(idRemainder))
                                .digest('hex')
                                .slice(0, idRemainder)
      options.torrent.id += remainderHash
    }

    this._ready = false

    readTorrent(source, (err, torrent) => {
      if (err) throw err

      this._torrentStream = torrentStream(torrent, options.torrent)
      this._torrentStream.on('uninterested', () => (this._torrentStream.swarm.pause()))
      this._torrentStream.on('interested', () => (this._torrentStream.swarm.resume()))

      this._torrentStream.on('ready', () => {
        if (typeof options.fileIndex !== 'number') {
          var index = this._torrentStream.files.reduce((a, b) => (
            a.length > b.length ? a : b
          )
          )
          index = this._torrentStream.files.indexOf(index)
        }

        this._torrentStream.files[index].select()
        this.file = this._torrentStream.torrent.files[index]
        this.filesize = this.file.length

        this.ready(this.file.createReadStream(), {length: this.filesize})
      })
    })
  }

  _requestProgress () {
    var swarm = this._torrentStream.swarm
    return {
      pieces: swarm.piecesGot,
      size: this.filesize,
      peers: swarm.wires.filter(wire => (!wire.peerChoking && wire.peerInterested)).length,
      seeds: swarm.wires.filter(wire => (!wire.peerInterested)).length,
      connections: swarm.wires.length,
      uploadSpeed: swarm.uploadSpeed()
    }
  }

  seek (start, end) {
    if (this._destroyed) throw new ReferenceError('Streamer already destroyed')
    if (!this._ready) return

    var opts = {
      start: start
    }

    if (end !== undefined) {
      opts.end = end
    }

    this.reset(this.file.createReadStream(opts), {length: this.file.length})
  }

  destroy () {
    super.destroy()

    this._torrentStream.destroy()
    this._torrentStream = null
  }
}

TorrentStreamer.config = config

module.exports = TorrentStreamer
