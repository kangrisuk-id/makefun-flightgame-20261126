// Tidewater Airlift — keyboard and mouse input.
// One file, one job: turns keys and pointer into one clean control vector.

export function createInput(canvas) {
  const keys = new Set();
  const state = {
    pitch: 0, throttle: 0, brake: false,
    mouseDown: false, mouseX: 0, mouseY: 0,
    pressed: new Set(), // edge-triggered keys, consumed by the game loop
  };

  function onKeyDown(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) state.pressed.add(e.code);
    keys.add(e.code);
  }
  function onKeyUp(e) { keys.delete(e.code); }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  // Pointer coords are converted to the canvas's internal 1280x720 space,
  // because CSS scaling makes offsetX/offsetY unreliable.
  function toCanvas(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (canvas.width / r.width),
      y: (e.clientY - r.top) * (canvas.height / r.height),
    };
  }
  canvas.addEventListener('mousedown', (e) => {
    state.mouseDown = true;
    const p = toCanvas(e);
    state.mouseX = p.x; state.mouseY = p.y;
  });
  window.addEventListener('mouseup', () => { state.mouseDown = false; });
  canvas.addEventListener('mousemove', (e) => {
    const p = toCanvas(e);
    state.mouseX = p.x; state.mouseY = p.y;
  });
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    const r = canvas.getBoundingClientRect();
    state.mouseDown = true;
    state.mouseX = (t.clientX - r.left) * (canvas.width / r.width);
    state.mouseY = (t.clientY - r.top) * (canvas.height / r.height);
  }, { passive: false });
  canvas.addEventListener('touchend', () => { state.mouseDown = false; });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    const r = canvas.getBoundingClientRect();
    state.mouseX = (t.clientX - r.left) * (canvas.width / r.width);
    state.mouseY = (t.clientY - r.top) * (canvas.height / r.height);
  }, { passive: false });

  // Reads the current control vector. planeScreenY lets the mouse steer by
  // pointing above (climb) or below (descend) the aircraft.
  function read(planeScreenY) {
    let pitch = 0;
    let throttle = 0;
    if (keys.has('ArrowUp') || keys.has('KeyW')) pitch += 1;
    if (keys.has('ArrowDown') || keys.has('KeyS')) pitch -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) throttle += 1;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) throttle -= 1;
    if (state.mouseDown) {
      pitch = Math.max(-1, Math.min(1, (planeScreenY - state.mouseY) / 120));
      throttle = state.mouseX > 640 ? 0.6 : 0; // right half of the screen: power on
    }
    state.pitch = pitch;
    state.throttle = throttle;
    state.brake = keys.has('Space');
    return state;
  }

  function wasPressed(code) {
    if (state.pressed.has(code)) { state.pressed.delete(code); return true; }
    return false;
  }
  function consumePressed() { state.pressed.clear(); }

  return { state, read, wasPressed, consumePressed };
}
