(function() {

var chip8 = chip8 || {};

// ROM
var romBuffer;
    //chip8.rom;
var romLoader = new XMLHttpRequest();
romLoader.onload = function(e) {
  romBuffer = romLoader.response;
  chip8.rom = new Uint8Array(romBuffer);

  chip8.init();
  chip8.loadGame();
  console.log("ready");
};
//romLoader.open('GET', 'roms/INVADERS', true);
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
var stackBuffer = new ArrayBuffer(32);
    chip8.stack = new Uint16Array(stackBuffer);
    chip8.sp    = 0;

// Timers
var soundTimer = 0,
    delayTimer = 0;

// Resolution 64x32 (2048 pixels) will display at: 320x160
var gfxBuffer = new ArrayBuffer(2048);
    chip8.gfx = new Uint8Array(gfxBuffer);
    drawFlag = false;

// Keypad 0x0-0xF (16)
var kpBuffer = new ArrayBuffer(0xF);
    chip8.kp = new Uint8Array(kpBuffer);
    chip8.keydown = 0;

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
  var i = 0;
  for (i = 0; i < chip8.stack.length; i++) { chip8.stack[i] = 0; }
  // Clear memory
  for (i = 0; i < chip8.ram.length; i++) { chip8.ram[i] = 0; }
  // Clear registers
  for (i = 0; i < chip8.v.length; i++) { chip8.v[i] = 0; }
  // Clear display
  for (i = 0; i < chip8.gfx.length; i++) { chip8.gfx[i] = 0; }
  
  document.getElementById('chip').addEventListener('keypress', function(e) { chip8.keydown = e.which; });
  document.getElementById('chip').addEventListener('keyup', function() { chip8.keydown = 0; });

};

chip8.loadGame = function() {
  // Font Set should live at 0x50 (80)
  var i = 0;
  for (i = 0; i < fontSet.length; i++) {
    chip8.ram[0x50 + i] = fontSet[i];
  }
  // Rom should live at 0x200 (512)
  for (i = 0; i < chip8.rom.length; i++) {
    chip8.ram[0x200 + i] = chip8.rom[i];
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
  chip8.opcode = (chip8.ram[chip8.pc] << 8) | chip8.ram[chip8.pc + 1];

  // Decode
  // Take first four bits by masking.
  chip8.opH = chip8.opcode & 0xF000;
  // Take the last four bits by masking.
  chip8.opL = chip8.opcode & 0x000F;

  var n   = chip8.opcode & 0x000F,
      nn  = chip8.opcode & 0x00FF,
      nnn = chip8.opcode & 0x0FFF,
      x   = (chip8.opcode & 0x0F00) >> 8,
      y   = (chip8.opcode & 0x00F0) >> 4;

  console.log(chip8.opcode.toString(16));
  // Execute
  // JSPerf says swtich is faster than a jump table...
  switch(chip8.opH) {
    case 0x0000:
      switch(chip8.opcode & 0x00FF) {
        case 0x00EE: // 00EE
          // Returns from a subroutine
          chip8.sp -= 1;
          chip8.pc = chip8.stack[chip8.sp];
          break;

        default:
          console.log("Unknown op: ", chip8.opcode.toString(16));
      }
      break;
    case 0x1000: // 1NNN
      // Jumps to address NNN
      chip8.pc = nnn;
      break;
    case 0x2000: // 2NNN
      // Calls subroutine at NNN
      chip8.stack[chip8.sp] = chip8.pc;
      chip8.sp += 1;
      chip8.pc = nnn;
      break;
    case 0x3000: // 3XNN
      // Skips the next instruction if VX equals NN
      if (chip8.v[x] === nn) { chip8.pc += 2; }
      chip8.pc += 2;
      break;
   case 0x4000: // 4XNN
      // Skips the next instruction if VX doesn't equal NN
      if (chip8.v[x] !== nn) { chip8.pc += 2; }
      chip8.pc += 2;
      break;
   case 0x6000: // 6XNN
      // Sets VX to NN
      chip8.v[x] = nn;
      chip8.pc += 2;
      break;
    case 0x7000: // 7XNN
      // Adds NN to VX
      chip8.v[x] += nn;
      chip8.pc += 2;
      break;
    case 0x8000:
      switch(chip8.opcode & 0x000F) {
        case 0x0000: // 8XY0
          // Sets VX to the value of VY
          chip8.v[x] = chip8.v[y];
          chip8.pc += 2;
          break;
        case 0x0002: // 8XY2
          // Sets VX to VX and VY
          chip8.v[x] &= chip8.v[y];
          chip8.pc += 2;
          break;
        default:
          console.log("Unknown op: ", chip8.opcode.toString(16));
      }
      break;
    case 0xA000: // ANNN
      // Sets I to the address NNN.
      chip8.I = nnn;
      chip8.pc += 2;
      break;
    //case 0xC000: // CXNN
      // Sets VX to a random number, masked by NN

    case 0xD000: // DXYN
      // Sprites stored in memory at location in index register (I), maximum 8bits wide. Wraps around the screen.
      // If when drawn, clears a pixel, register VF is set to 1 otherwise it is zero.
      // All drawing is XOR drawing (i.e. it toggles the screen pixels)
      var x = (chip8.opcode & 0x0F00) >> 8;
          x = chip8.v[x];
      var y = (chip8.opcode & 0x00F0) >> 4;
          y = chip8.v[y];
      var n = chip8.opcode & 0x000F,
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
          chip8.gfx[loc] = p;
        }
      }

      drawFlag = true;
      chip8.pc += 2;
      break;
   case 0xE000:
      switch(chip8.opcode & 0x000F) {
        case 0x0001:
          // Skips the next instruction if the key stored in VX isn't pressed.
          if (chip8.keydown !== chip8.v[x]) { chip8.pc += 2; }
          chip8.pc += 2;
          break;
        default:
          console.log("Unknown op: ", chip8.opcode.toString(16));
      }
      break;
   case 0xF000:
      switch(chip8.opcode & 0x00FF) {
        case 0x001E: // FX1E
          // Adds VX to I  
          chip8.I += chip8.v[x]; 
          chip8.pc += 2;
          break;
        case 0x0065: // FX65
          // Fills V0 to VX with values from memory starting at address I
          for (var i = 0; i <= x; i++) {
            chip8.v[i] = chip8.ram[chip8.I + i];
          }
          chip8.pc += 2;
          break;
        default: 
          console.log("Unknown op: ", chip8.opcode.toString(16));
      }
      break;
   default:
      console.log("Unknown op: ", chip8.opcode.toString(16));
  }
};







  // Resolution 64x32 (2048 pixels) will display at: 320x160
  var ctx = document.getElementById('screen').getContext('2d');
  chip8.render = function() {
    var w  = 320,
        h  = 160,
        xp = 32,
        yp = 64;

    ctx.clearRect(0, 0, 320, 160);

    for (var i = 0; i < 2048; i++) {
      var x = i % 64,
          y = (i / 64) << 0;
      if (chip8.gfx[i] === 1) { ctx.fillRect(x * 5, y * 5, 5, 5); }
    }

    drawFlag = false;
  };
  

  var animationID;
  chip8.loop = function() {
    chip8.opCycle();
    if (drawFlag === true) { chip8.render(); }
    if (chip8.soundTimer !== 0) { chip8.soundTimer -= 1; }
    if (chip8.delayTimer !== 0) { chip8.delayTimer -= 1; }
    animationID = requestAnimationFrame(chip8.loop);
  };

  chip8.stop = function() {
    cancelAnimationFrame(animationID);
  };

  window.chip8 = chip8;

}());


