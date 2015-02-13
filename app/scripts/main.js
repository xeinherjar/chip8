(function() {

var chip8 = chip8 || {};

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




// Registers v0-vF (0x0 - 0xF)
// 16 8 bit registers.  VF doubles as carry flag.
var vBuffer  = new ArrayBuffer(0xF);
    chip8.v  = new Uint8Array(vBuffer);
// Index register 16-bits wide. (address register)
    chip8.I  = 0;
// Program Counter 16-bits wide.
    chip8.pc = 0;

// Memory 0x000-0xFFF (4096) bytes
// 0x200 (512) start of application space
// 0xEA0-0xEFF (3744-3829) callstack
// 0xF00-0xFFF (3840-4095) display refresh (not used)
var ramBuffer   = new ArrayBuffer(4096);
    chip8.ram   = new Uint8Array(ramBuffer);
    // Stack, homebrew games can expect up to 16 levels (2 bytes per level).
    stackBuffer = new ArrayBuffer(32); 
    chip8.stack = new Uint16Array(stackBuffer);
    chip8.sp    = 0;

// Timers
var soundTimer = 0,
    delayTimer = 0;

// Resolution 64x32 (2048 pixels) will display at: 320x160
var gfxBuffer = new ArrayBuffer(2048);
    chip8.gfx = new Uint8Array(gfxBuffer);

// Keypad 0x0-0xF (16)
var kpBuffer = new ArrayBuffer(0xF);
    chip8.kp = new Uint8Array(kpBuffer);


// Cycle: Fetch, Decode, Execute
// Opcodes are two bytes





  window.chip8 = chip8;

}());
