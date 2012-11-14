window.onload = function() {
  navigator.mozSetMessageHandler('activity', handleOpenActivity);
};

function handleOpenActivity(request) {
  console.log('Got web activity!');

  var blob = request.source.data.blob;
  var fileName = request.source.data.filename;

  var storage = navigator.getDeviceStorage('music');
  var getRequest = storage.get(fileName);

  getRequest.onsuccess = function() {
    var file = getRequest.result;
    var url = URL.createObjectURL(file);
  
    PlayerView.audio.src = url;

    parseAudioMetadata(file, gotMetadata, metadataError);

    console.log('blob URL: ' + url);
    console.log('getRequest.result.name: ' + getRequest.result.name);
  };
  getRequest.onerror = function() {
    var errmsg = getRequest.error && getRequest.error.name;
    console.error('Music.getFile:', errmsg);
  }

  function metadataError(e) {
    console.warn('parseAudioMetadata: error parsing metadata - ', e);
  }
  function gotMetadata(metadata) {
    console.log('metadata.artist: ' + metadata.artist);
    console.log('metadata.album: ' + metadata.album);
  }
}
