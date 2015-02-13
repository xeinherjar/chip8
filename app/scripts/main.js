(function() {

var chip8 = chip8 || {};

// ROM
var romBuffer;
var rom;
var romLoader = new XMLHttpRequest();
romLoader.onload = function(e) {
  romBuffer = romLoader.response;
  rom = new Uint8Array(romBuffer);

  chip8.init();
  chip8.loadGame();
  console.log("ready");
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
    chip8.gfx = new Uint8Array(gfxBuffer),
    drawFlag = false;

// Keypad 0x0-0xF (16)
var kpBuffer = new ArrayBuffer(0xF);
    chip8.kp = new Uint8Array(kpBuffer);

// Font Set
var fontSet = [
  0xF0, 0x90, 0x90, 0x90, 0xF0, // 0
  0x20, 0x60, 0x20, 0x20, 0x70, // 1
  0xF0, 0x10, 0xF0, 0x80, 0xF0, // 2
  0xF0, 0x10, 0xF0, 0x10, 0xF0, // 3
  0x90, 0x90, 0xF0, 0x10, 0x10, // 4
  0xF0, 0x80, 0xF0, 0x10, 0xF0, // 5
  0xF0, 0x80, 0xF0, 0x90, 0xF0, // 6
  0xF0, 0x10, 0x20, 0x40, 0x40, // 7
  0xF0, 0x90, 0xF0, 0x90, 0xF0, // 8
  0xF0, 0x90, 0xF0, 0x10, 0xF0, // 9
  0xF0, 0x90, 0xF0, 0x90, 0x90, // A
  0xE0, 0x90, 0xE0, 0x90, 0xE0, // B
  0xF0, 0x80, 0x80, 0x80, 0xF0, // C
  0xE0, 0x90, 0x90, 0x90, 0xE0, // D
  0xF0, 0x80, 0xF0, 0x80, 0xF0, // E
  0xF0, 0x80, 0xF0, 0x80, 0x80  // F
];


chip8.init = function() {
  // Reset | Set inital state of machine.
  // Index starts at 0
  chip8.I = 0;
  // Program Counters starts at 0x200, first op instruciton location.
  chip8.pc = 0x200;
  // Stack back at 0
  chip8.sp = 0;
  // Reset current opcode
  chip8.opcode = 0;

  // According to JSPerf, setting items to 0 is fater than recreating new buffer.
  // Clear stack
  for (var i = 0; i < chip8.stack.length; i++) { chip8.stack[i] = 0; }
  // Clear memory
  for (var i = 0; i < chip8.ram.length; i++) { chip8.ram[i] = 0; }
  // Clear registers
  for (var i = 0; i < chip8.v.length; i++) { chip8.v[i] = 0; }
  // Clear display
  for (var i = 0; i < chip8.gfx.length; i++) { chip8.gfx[i] = 0; }

};

chip8.loadGame = function() {
  // Font Set should live at 0x50 (80)
  for (var i = 0; i < fontSet.length; i++) {
    chip8.ram[0x50 + i] = fontSet[i];
  }
  // Rom should live at 0x200 (512)
  for (var i = 0; i < rom.length; i++) {
    chip8.ram[0x200 + i] = rom[i];
  }
};


// Cycle: Fetch, Decode, Execute, Update (draw, timers)
chip8.opcode = 0;
// opcode high bit
chip8.opH = 0;
// opcode low bit
chip8.opL = 0;
chip8.opCycle = function() {
  // Fetch
  // Opcodes are two bytes, shift left 8 bits, OR in next byte.
  chip8.opcode = chip8.ram[chip8.pc] << 8 | chip8.ram[chip8.pc + 1];
  // Decode
  // Take first four bits by masking.
  chip8.opH = chip8.opcode & 0xF000;
  // Take the last four bits by masking.
  chip8.opL = chip8.opcode & 0x000F;

  // Execute
  // JSPerf says swtich is faster than a jump table...
  switch(chip8.opH) {
    case 0x7000: // 7XNN
      // Adds NN to VX
      chip8.v[chip8.opcode & 0x0F00] = chip8.opcode & 0x00FF;
      chip8.pc += 2;
      break;
    case 0x6000: // 6XNN
      // Sets VX to NN
      chip8.v[chip8.opcode & 0x0F00] = chip8.opcode & 0x00FF;
      chip8.pc += 2;
      break;
    case 0xA000: // ANNN
      // Sets I to the address NNN.
      chip8.I = chip8.opcode & 0x0FFF;
      chip8.pc += 2;
      break;
    case 0xD000: // DXYN
      // Sprites stored in memory at location in index register (I), maximum 8bits wide. Wraps around the screen.
      // If when drawn, clears a pixel, register VF is set to 1 otherwise it is zero.
      // All drawing is XOR drawing (i.e. it toggles the screen pixels)
      var x = (chip8.opcode & 0x0F00) >> 8,
          x = chip8.v[x],
          y = (chip8.opcode & 0x00F0) >> 4,
          y = chip8.v[y],
          n = chip8.opcode & 0x000F,
          pixel;

      // Reset collision flag
      chip8.v[0xF] = 0;

      var yi,
          xi,
          p;
      for (yi = 0; yi < n; yi++) {
        pixel = chip8.ram[chip8.I + yi];
        // convert to pixel data, we need 8 bits but JavaScript will only print what is needed.
        pixel = ("00000000" + pixel.toString(2)).substr(-8);
        for (xi = 0; xi < pixel.length; xi++) {
          p = pixel[xi] === "1" ? 1 : 0;
          // Where to draw the pixel.
          loc = ((y + yi) * 64) + x + xi; 

          // Check for collision
          if (p === 1 && chip8.gfx[loc] === 1) { chip8.v[0xF] = 1; }
          // XOR draw;
          chip8.gfx[loc] ^= 1;
        }
      }
      
      drawFlag = true;
      chip8.pc += 2;
      break;
   default:
      console.log("Unknown op: ", chip8.opcode.toString(16));
  }
};







  // Resolution 64x32 (2048 pixels) will display at: 320x160
  var ctx = document.getElementById('screen').getContext('2d');
  chip8.render = function() {
    var w  = 320,
        y  = 160,
        xp = 32,
        yp = 64;

    ctx.clearRect(0, 0, 320, 160);

    for (var i = 0; i < 2048; i++) {
      var x = i % 64,
          y = (i / 64) << 0;
      if (chip8.gfx[i] === 1) { ctx.fillRect(x + 5, y + 5, 5, 5); }
    };

    drawFlag = false;
  }


  chip8.loop = function() {
    chip8.opCycle(); 
    if (drawFlag === true) { chip8.render(); }
  };





  window.chip8 = chip8;

}());


