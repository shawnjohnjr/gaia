// Repeat option for player
var REPEAT_OFF = 0;
var REPEAT_LIST = 1;
var REPEAT_SONG = 2;

// Key for store options of repeat and shuffle
var SETTINGS_OPTION_KEY = 'settings_option_key';

// View of Player
var PlayerView = {
  get view() {
    delete this._view;
    return this._view = document.getElementById('views-player');
  },

  get audio() {
    delete this._audio;
    return this._audio = document.getElementById('player-audio');
  },

  get isPlaying() {
    return this._isPlaying;
  },

  set isPlaying(val) {
    this._isPlaying = val;
  },

  get dataSource() {
    return this._dataSource;
  },

  set dataSource(source) {
    this._dataSource = source;
  },

  init: function pv_init() {
    this.artist = document.getElementById('player-cover-artist');
    this.album = document.getElementById('player-cover-album');

    this.timeoutID;
    this.cover = document.getElementById('player-cover');
    this.coverImage = document.getElementById('player-cover-image');

    this.repeatButton = document.getElementById('player-album-repeat');
    this.shuffleButton = document.getElementById('player-album-shuffle');

    this.ratings = document.getElementById('player-album-rating').children;

    this.seekBar = document.getElementById('player-seek-bar-progress');
    this.seekElapsed = document.getElementById('player-seek-elapsed');
    this.seekRemaining = document.getElementById('player-seek-remaining');

    this.playControl = document.getElementById('player-controls-play');

    this.isPlaying = false;
    this.dataSource = [];
    this.currentIndex = 0;
    this.backgroundIndex = 0;

    asyncStorage.getItem(SETTINGS_OPTION_KEY, this.setOptions.bind(this));

    this.view.addEventListener('click', this);

    // Seeking audio too frequently causes the Desktop build hangs
    // A related Bug 739094 in Bugzilla
    this.seekBar.addEventListener('mousemove', this);

    this.audio.addEventListener('timeupdate', this);
    this.audio.addEventListener('ended', this);

    // A timer we use to work around
    // https://bugzilla.mozilla.org/show_bug.cgi?id=783512
    this.endedTimer = null;
  },

  setSourceType: function pv_setSourceType(type) {
    this.sourceType = type;
  },

  // This function is for the animation on the album art (cover).
  // The info (album, artist) will initially show up when a song being played,
  // if users does not tap the album art (cover) again,
  // then it will be disappeared after 5 seconds
  // however, if a user taps before 5 seconds ends,
  // then the timeout will be cleared to keep the info on screen.
  showInfo: function pv_showInfo() {
    this.cover.classList.add('slideOut');

    if (this.timeoutID)
      window.clearTimeout(this.timeoutID);

    this.timeoutID = window.setTimeout(
      function pv_hideInfo() {
        this.cover.classList.remove('slideOut');
      }.bind(this),
      5000
    );
  },

  setCoverBackground: function pv_setCoverBackground(index) {
    var realIndex = index % 10;

    this.cover.classList.remove('default-album-' + this.backgroundIndex);
    this.cover.classList.add('default-album-' + realIndex);
    this.backgroundIndex = realIndex;
  },

  setCoverImage: function pv_setCoverImage(fileinfo) {
    // Reset the image to be ready for fade-in
    this.coverImage.src = '';
    this.coverImage.classList.remove('fadeIn');

    // Set source to image and crop it to be fitted when it's onloded
    if (fileinfo.metadata.picture) {
      createAndSetCoverURL(this.coverImage, fileinfo);
      this.coverImage.addEventListener('load', pv_showImage);
    }

    function pv_showImage(evt) {
      evt.target.removeEventListener('load', pv_showImage);
      cropImage(evt);
      evt.target.classList.add('fadeIn');
    };
  },

  setOptions: function pv_setOptions(settings) {
    var repeatOption = (settings && settings.repeat) ?
      settings.repeat : REPEAT_OFF;
    var shuffleOption = (settings && settings.shuffle) ?
      settings.shuffle : false;

    this.setRepeat(repeatOption);
    this.setShuffle(shuffleOption);
  },

  setRepeat: function pv_setRepeat(value) {
    var repeatClasses = ['repeat-off', 'repeat-list', 'repeat-song'];

    // Remove all repeat classes before applying a new one
    repeatClasses.forEach(function pv_resetRepeat(targetClass) {
      this.repeatButton.classList.remove(targetClass);
    }.bind(this));

    this.repeatOption = value;
    this.repeatButton.classList.add(repeatClasses[this.repeatOption]);
  },

  setShuffle: function pv_setShuffle(value) {
    this.shuffleOption = value;

    if (this.shuffleOption) {
      this.shuffleButton.classList.add('shuffle-on');
    } else {
      this.shuffleButton.classList.remove('shuffle-on');
    }
  },

  setRatings: function pv_setRatings(rated) {
    for (var i = 0; i < 5; i++) {
      var rating = this.ratings[i];

      if (i < rated) {
        rating.classList.add('star-on');
      } else {
        rating.classList.remove('star-on');
      }
    }
  },

  play: function pv_play(target, backgroundIndex) {
    this.isPlaying = true;

    if (this.endedTimer) {
      clearTimeout(this.endedTimer);
      this.endedTimer = null;
    }

    this.showInfo();

    if (target) {
      var targetIndex = parseInt(target.dataset.index);
      var songData = this.dataSource[targetIndex];

      //TitleBar.changeTitleText(songData.metadata.title || unknownTitle);
      this.artist.textContent = songData.metadata.artist || unknownArtist;
      this.album.textContent = songData.metadata.album || unknownAlbum;
      this.currentIndex = targetIndex;

      // backgroundIndex is from the index of sublistView
      // for playerView to show same default album art (same index)
      if (backgroundIndex || backgroundIndex === 0) {
        this.setCoverBackground(backgroundIndex);
      }

      // We only update the default album art when source type is MIX
      if (this.sourceType === TYPE_MIX) {
        this.setCoverBackground(targetIndex);
      }

      this.setCoverImage(songData);

      // set ratings of the current song
      this.setRatings(songData.metadata.rated);

      // update the metadata of the current song
      songData.metadata.played++;
      musicdb.updateMetadata(songData.name, songData.metadata);

      musicdb.getFile(songData.name, function(file) {
        // An object URL must be released by calling URL.revokeObjectURL()
        // when we no longer need them
        var url = URL.createObjectURL(file);
        this.audio.src = url;
        this.audio.onloadeddata = function(evt) { URL.revokeObjectURL(url); };

        // when play a new song, reset the seekBar first
        // this can prevent showing wrong duration
        // due to b2g cannot get some mp3's duration
        // and the seekBar can still show 00:00 to -00:00
        this.setSeekBar(0, 0, 0);
      }.bind(this));
    } else {
      this.audio.play();
    }

    this.playControl.classList.remove('is-pause');
  },

  pause: function pv_pause() {
    this.isPlaying = false;

    this.audio.pause();

    this.playControl.classList.add('is-pause');
  },

  next: function pv_next(isAutomatic) {
    var songElements = (this.sourceType === TYPE_MIX) ?
      TilesView.view.children : SubListView.anchor.children;

    // We only repeat a song automatically. (when the song is ended)
    // If users click skip forward, player will go on to next one
    if (this.repeatOption === REPEAT_SONG && isAutomatic) {
      this.play(songElements[this.currentIndex].firstElementChild);
      return;
    }

    // If it's a last song and repeat list is OFF, ignore it.
    // but if repeat list is ON, player will restart from the first song
    if (this.currentIndex >= this.dataSource.length - 1) {
      if (this.repeatOption === REPEAT_LIST) {
        this.currentIndex = 0;
      } else {
        return;
      }
    } else {
      this.currentIndex++;
    }

    this.play(songElements[this.currentIndex].firstElementChild);
  },

  previous: function pv_previous() {
    var songElements = (this.sourceType === TYPE_MIX) ?
      TilesView.view.children : SubListView.anchor.children;

    // If a song starts more than 3 (seconds),
    // when users click skip backward, it will restart the current song
    // otherwise just skip to the previous song
    if (this.audio.currentTime > 3) {
      this.play(songElements[this.currentIndex].firstElementChild);
      return;
    }

    // If it's a first song and repeat list is ON, go to the last one
    // or just restart from the beginning when repeat list is OFF
    if (this.currentIndex <= 0) {
      this.currentIndex = (this.repeatOption === REPEAT_LIST) ?
        this.dataSource.length - 1 : 0;
    } else {
      this.currentIndex--;
    }

    this.play(songElements[this.currentIndex].firstElementChild);
  },

  updateSeekBar: function pv_updateSeekBar() {
    if (this.isPlaying) {
      this.seekAudio();
    }
  },

  seekAudio: function pv_seekAudio(seekTime) {
    if (seekTime)
      this.audio.currentTime = seekTime;

    // mp3 returns in microseconds
    // ogg returns in seconds
    // note this may be a bug cause mp3 shows wrong duration in
    // gecko's native audio player
    // A related Bug 740124 in Bugzilla
    var startTime = this.audio.startTime;

    var originalEndTime =
      (this.audio.duration && this.audio.duration != 'Infinity') ?
      this.audio.duration :
      this.audio.buffered.end(this.audio.buffered.length - 1);

    // now mp3 returns in seconds, but keep this checking to prevent bugs
    var endTime = (originalEndTime > 1000000) ?
      Math.floor(originalEndTime / 1000000) :
      Math.floor(originalEndTime);

    var currentTime = this.audio.currentTime;

    this.setSeekBar(startTime, endTime, currentTime);
  },

  setSeekBar: function pv_setSeekBar(startTime, endTime, currentTime) {
    this.seekBar.min = startTime;
    this.seekBar.max = endTime;
    this.seekBar.value = currentTime;

    this.seekElapsed.textContent = formatTime(currentTime);
    this.seekRemaining.textContent = '-' + formatTime(endTime - currentTime);
  },

  handleEvent: function pv_handleEvent(evt) {
    var target = evt.target;
      if (!target)
        return;

    switch (evt.type) {
      case 'click':
        switch (target.id) {
          case 'player-cover':
          case 'player-cover-image':
            this.showInfo();

            break;

          case 'player-seek-bar-progress':
            // target is the seek bar, and evt.layerX is the clicked position
            var seekTime = evt.layerX / target.clientWidth * target.max;
            this.seekAudio(seekTime);

            break;

          case 'player-controls-previous':
            this.previous();

            break;

          case 'player-controls-play':
            if (this.isPlaying) {
              this.pause();
            } else {
              this.play();
            }

            break;

          case 'player-controls-next':
            this.next();

            break;

          case 'player-album-repeat':
            this.showInfo();

            var newValue = ++this.repeatOption % 3;
            // Store the option when it's triggered by users
            asyncStorage.setItem(SETTINGS_OPTION_KEY, {
              repeat: newValue,
              shuffle: this.shuffleOption
            });

            this.setRepeat(newValue);

            break;

          case 'player-album-shuffle':
            this.showInfo();

            var newValue = !this.shuffleOption;
            // Store the option when it's triggered by users
            asyncStorage.setItem(SETTINGS_OPTION_KEY, {
              repeat: this.repeatOption,
              shuffle: newValue
            });

            this.setShuffle(newValue);

            break;
        }

        if (target.dataset.rating) {
          this.showInfo();

          var songData = this.dataSource[this.currentIndex];
          songData.metadata.rated = parseInt(target.dataset.rating);

          musicdb.updateMetadata(songData.name, songData.metadata,
            this.setRatings.bind(this, parseInt(target.dataset.rating)));
        }

        break;
      case 'mousemove':
        // target is the seek bar, and evt.layerX is the moved position
        var seekTime = evt.layerX / target.clientWidth * target.max;
        this.seekAudio(seekTime);
        break;
      case 'timeupdate':
        this.updateSeekBar();

        // Since we don't always get reliable 'ended' events, see if
        // we've reached the end this way.
        // See: https://bugzilla.mozilla.org/show_bug.cgi?id=783512
        // If we're within 1 second of the end of the song, register
        // a timeout to skip to the next song one second after the song ends
        if (this.audio.currentTime >= this.audio.duration - 1 &&
            this.endedTimer == null) {
          var timeToNext = (this.audio.duration - this.audio.currentTime + 1);
          this.endedTimer = setTimeout(function() {
                                         this.endedTimer = null;
                                         this.next(true);
                                       }.bind(this),
                                       timeToNext * 1000);
        }
        break;
      case 'ended':
        // Because of the workaround above, we have to ignore real ended
        // events if we already have a timer set to emulate them
        if (!this.endedTimer)
          this.next(true);
        break;

      default:
        return;
    }
  }
};
