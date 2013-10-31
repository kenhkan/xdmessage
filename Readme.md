# XDMessage

PostMesssage wrapper for IFrames and Popup windows with callback support. Tries to replicate similar functionality in easyXDM but in a smaller package.

## Getting Started

    bower install xdmessage

or download `xdmessage.js` and include manually.

## Usage

### Parent window code:

```HTML

<script src="//static.getchute.com/js/xdmessage.js"></script>

<script type="text/javascript">
  window.onload = function() {
    var xd = new XDMessage('http://yourdomain.com/iframe.html', { container: document.getElementById('iframe-container') });

    xd.on('ready', function() {
      // invoke a method with custom data
      xd.invoke('test-message', { "a" : "b" }, function(data) {
        console.log(data);
        // > { "b" : "c" }
      });
    });

    xd.open();
  }
</script>

<!--IFrame will be injected here -->
<div id="iframe-container"></div>

```

### IFrame code:

```HTML

<script src="//static.getchute.com/js/xdmessage.js"></script>

<script type="text/javascript">
  window.onload = function() {
    var xd = new XDMessage();

    xd.on('ready', function() {
      // ready
    });

    xd.on('test-message', function(data, callback){
      console.log(data);
      // > { "a" : "b" }
      callback({ "b" : "c" });
    });

    xd.open();
  }
</script>

```
