(function() {

  var assetURL = 'https://demo.castlabs.com/tmp/text0.mp4';

  // Fetch file with response type ArrayBuffer
  fetchAB(assetURL, function(buffer) {
    console.log('Successfully loaded file', assetURL);
    // Covert ArrayBuffer to Uint8Array
    var byteArray = new Uint8Array(buffer);
    // Inspect mp4
    var boxes = inspect(byteArray);
    // Print boxes
    //console.log(boxes);
    printBoxes(boxes)
  });

  // Boxes
  var parseType = function(buffer) {
    var result = '';
    result += String.fromCharCode(buffer[0]);
    result += String.fromCharCode(buffer[1]);
    result += String.fromCharCode(buffer[2]);
    result += String.fromCharCode(buffer[3]);
    return result;
  };

  var parse = {
    moof: function(data) {
      return {
        boxes: inspect(data)
      };
    },
    traf: function(data) {
      return {
        boxes: inspect(data)
      };
    },
  };

  function inspect(data) {
    var
      start = 0,
      result = [],
      view,
      size,
      type,
      end,
      box;

    // Convert data from Uint8Array to ArrayBuffer, to follow Dataview API
    var buffer = new ArrayBuffer(data.length);
    var byteArray = new Uint8Array(buffer);
    for(var z = 0; z < data.length; ++z) {
      byteArray[z] = data[z];
    }
    view = new DataView(buffer);

    while (start < data.byteLength) {
      // Parse box data
      size = view.getUint32(start);
      type =  parseType(data.subarray(start + 4, start + 8));
      end = size > 1 ? start + size : data.byteLength;

      // Parse type-specific data
      box = (parse[type] || function(data) {
        return {
          data: data
        };
      })(data.subarray(start + 8, end));

      box.size = size;
      box.type = type;

      // Store this box and move to the next
      result.push(box);
      start = end;
    }

    return result;
  }

  // Print
  function printBoxes(inspected) {
    for(var i in inspected) { // use for-in for ES5 (IE 11) instead of for-of
      var box = inspected[i];
      console.log('Found box of type', box.type, 'and size', box.size);
      if(box.type === 'mdat') {
        parseBoxData(box);
      }
      if(box.boxes) {
        printBoxes(box.boxes);
      }
    }
  }

  // Parse box data
  function parseBoxData(box) {
    if(!box.data) {
      return;
    }

    var str = byteArrayToString(box.data);
    console.log('Content of', box.type, 'box is', str);

    try {
      var allCues = parseTTML(str);
      // Iterate all cues
      for(var i in allCues) {
        // Iterate metadataElements
        var cue = allCues[i];
        var metadataElements = cue.metadataElements;
        for(var y in metadataElements) {
          // Check if element encoding is base64, then create image with data and append into the body
          var metadataElement = metadataElements[y];
          if(metadataElement.encoding == 'base64') {
            var img = new Image();
            img.src = `data:image/${metadataElement.imagetype};${metadataElement.encoding},${metadataElement.data}`;
            document.body.appendChild(img);
          }
        }
      }
    } catch (exception) {
      console.log(exception);
    }
  }



  // Utils
  function fetchAB(url, cb) {
    var xhr = new XMLHttpRequest;
    xhr.open('get', url);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function() {
      cb(xhr.response);
    };
    xhr.onerror = function() {
      console.log('error');
    };
    xhr.send();
  }

  // Convert byteArray to String
  function byteArrayToString(bytes) {
    var binary = '';
    var len = bytes.byteLength;
    for(var i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return binary;
  }

  // Parse TTML
  function parseTTML(str) {

    var parser = new window.DOMParser(); // create instance of DOMParser
    var cues = [];
    var xml = null;

    if(str == '') {
      return cues;
    }

    try {
      xml = parser.parseFromString(str, 'text/xml');
    } catch (exception) {
      throw new Error('Failed to parse TTML.');
    }

    if(xml) {
      var parserError = xml.getElementsByTagName('parsererror')[0];
      if(parserError) {
        throw new Error(parserError.textContent);
      }

      var tt = xml.getElementsByTagName('tt')[0];
      // TTML should always have tt element
      if(!tt) {
        throw new Error('TTML does not contain <tt> tag.');
      }

      // body
      var body = tt.getElementsByTagName('body')[0];
      if(!body) {
        return cues;
      }

      // metadata
      var metadata = tt.getElementsByTagName('metadata')[0];
      var metadataElements = metadata ? getElementChildren(metadata) : [];

      // Create cue and set keys
      var cue = {
        metadataElements: parseMetadataElements(metadataElements)
      };

      // Append to cue to cues
      cues.push(cue);
    }

    return cues;
  }

  function parseMetadataElements(elements) {
    var items = [];

    if(elements && elements.length < 0) {
      return items;
    }

    for(var i in elements) {
      var el = elements[i];
      var attrs = el.attributes; // get all attributes for checking if att exists before getAttribute
      items.push({
        id: attrs['xml:id'] ? el.getAttribute('xml:id') : null,
        imagetype: attrs['imagetype'] ? el.getAttribute('imagetype').toLowerCase() : null,
        encoding: attrs['encoding'] ? el.getAttribute('encoding').toLowerCase() : null,
        data: el.textContent ? el.textContent.trim() : null
      });
    }

    return items;
  }

  // XML/DOM helper
  function getElementChildren(element) {
    return toArray(element.childNodes).filter(function(child) {
      return child instanceof Element;
    });
  }

  // toArray for instead of Array.from - ES5
  function toArray(obj) {
    var array = [];
    // iterate backwards ensuring that length is an UInt32
    for(var i = obj.length >>> 0; i--;) {
      array[i] = obj[i];
    }
    return array;
  }

})();
