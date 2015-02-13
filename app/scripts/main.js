(function() {

// ROM
var romBuffer;
var rom;
var romLoader = new XMLHttpRequest();
romLoader.onload = function(e) {
  romBuffer = romLoader.response;
  rom = new Uint8Array(romBuffer);
};
romLoader.open('GET', 'roms/Breakout.ch8', true);
romLoader.responseType = 'arraybuffer';
romLoader.send(null);

// SYSTEM



// Registers 0x0 - 0xF
var v = new Array(0xF);

// Memory 4096
var ramBuffer = new ArrayBuffer(4096);
var ram = new Int8Array(ramBuffer);


// Resolution 64x32 -- 320x160

}());
