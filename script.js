document.documentElement.classList.add("js");

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const header = document.querySelector(".site-header");
const progress = document.querySelector(".scroll-progress span");
let scrollTicking = false;

function updateScrollEffects() {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  progress.style.transform = `scaleX(${maxScroll > 0 ? window.scrollY / maxScroll : 0})`;
  header.classList.toggle("is-scrolled", window.scrollY > 30);
  scrollTicking = false;
}

window.addEventListener("scroll", () => {
  if (!scrollTicking) {
    window.requestAnimationFrame(updateScrollEffects);
    scrollTicking = true;
  }
}, { passive: true });
updateScrollEffects();

const hero = document.querySelector(".hero");
let heroField = hero.querySelector(".hero__field");
const heroPalette = [[255, 195, 116], [255, 118, 148], [179, 126, 255], [107, 163, 255], [103, 221, 255]];
const heroHoverPalette = [[255, 183, 115], [243, 123, 161], [174, 134, 246], [112, 183, 240], [167, 225, 250]];

function createGPUField(canvas) {
  const gl = canvas.getContext("webgl2", { alpha: true, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
  if (!gl) return null;
  try {
    const vertexSource = `#version 300 es
      precision highp float;
      layout(location=0) in vec2 corner;
      layout(location=1) in vec3 origin;
      layout(location=2) in vec4 baseColor;
      layout(location=3) in vec2 face;
      uniform vec2 resolution, pointer, velocity, wake, heading;
      uniform float motion, hover;
      out vec2 local;
      out vec4 color;
      vec3 spectrum(float hue) {
        vec3 amber=vec3(${heroHoverPalette[0].join(",")})/255.;
        vec3 rose=vec3(${heroHoverPalette[1].join(",")})/255.;
        vec3 violet=vec3(${heroHoverPalette[2].join(",")})/255.;
        vec3 blue=vec3(${heroHoverPalette[3].join(",")})/255.;
        vec3 ice=vec3(${heroHoverPalette[4].join(",")})/255.;
        if (hue<.25) return mix(amber,rose,hue*4.);
        if (hue<.5) return mix(rose,violet,(hue-.25)*4.);
        if (hue<.75) return mix(violet,blue,(hue-.5)*4.);
        return mix(blue,ice,(hue-.75)*4.);
      }
      void main() {
        vec2 normal=vec2(-heading.y,heading.x);
        vec2 offset=origin.xy-mix(pointer,wake,.5);
        float along=dot(offset,heading);
        float across=dot(offset,normal);
        float reach=length(vec2(along/110.,across/76.));
        float proximity=max(0.,1.-reach);
        proximity=proximity*proximity;
        float strength=min(30.,length(velocity)*.05)*proximity*motion;
        float curl=sin(across*.018+along*.008)*strength*.28;
        float portraitGrip=1.-face.x*.25;
        vec2 push=(heading*strength+normal*curl)*portraitGrip;
        float rotation=(heading.x*sin(origin.z)-heading.y*cos(origin.z))*proximity*motion*1.05*portraitGrip;
        rotation+=curl*.028;
        float angle = origin.z+rotation;
        local = corner*vec2(4.0,1.7);
        vec2 rotated = vec2(cos(angle)*local.x-sin(angle)*local.y,sin(angle)*local.x+cos(angle)*local.y);
        vec2 position = origin.xy+push+rotated;
        gl_Position = vec4(position.x/resolution.x*2.0-1.0,1.0-position.y/resolution.y*2.0,0.0,1.0);
        float hue = clamp(.5-along/240.+across/360.,0.0,1.0);
        vec3 light = spectrum(hue);
        float tone=1.-face.x+face.x*(.08+face.y*.92);
        // Color belongs to each moving stick, with no stationary cursor spotlight.
        float energy=clamp(length(push)/22.+abs(rotation)*.38,0.,1.)*hover;
        color=vec4(mix(baseColor.rgb,light*tone,energy),baseColor.a+(.94-baseColor.a)*energy*(1.-face.x*.65));
      }`;
    const fragmentSource = `#version 300 es
      precision highp float;
      in vec2 local;
      in vec4 color;
      out vec4 outputColor;
      void main() {
        float distance=length(vec2(max(abs(local.x)-2.65,0.0),local.y))-.65;
        float edge=max(fwidth(distance)*.7,.15);
        float coverage=1.-smoothstep(-edge,edge,distance);
        outputColor=vec4(color.rgb,color.a*coverage);
      }`;
    function compile(type, source) {
      const shader=gl.createShader(type);
      gl.shaderSource(shader,source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    }
    const program=gl.createProgram();
    const vertex=compile(gl.VERTEX_SHADER,vertexSource), fragment=compile(gl.FRAGMENT_SHADER,fragmentSource);
    gl.attachShader(program,vertex); gl.attachShader(program,fragment); gl.linkProgram(program);
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    const vertices=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,vertices);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    const instances=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,instances);
    for (const [location,size,offset] of [[1,3,0],[2,4,12],[3,2,28]]) {
      gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location,size,gl.FLOAT,false,36,offset); gl.vertexAttribDivisor(location,1);
    }
    const uniforms=Object.fromEntries(["resolution","pointer","velocity","wake","heading","motion","hover"].map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0,0,0,0);
    let count=0, width=1, height=1;
    canvas.dataset.renderer="gpu";
    return {
      upload(strokes, nextWidth, nextHeight) {
        width=nextWidth; height=nextHeight; count=strokes.length;
        const data=new Float32Array(count*9);
        strokes.forEach((stroke,index)=>data.set([stroke.x,stroke.y,stroke.angle,stroke.red/255,stroke.green/255,stroke.blue/255,stroke.alpha,stroke.mask,stroke.brightness],index*9));
        gl.bindBuffer(gl.ARRAY_BUFFER,instances); gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
        gl.viewport(0,0,canvas.width,canvas.height);
      },
      draw(pointer, motion, hover, flow) {
        if (gl.isContextLost()) return;
        gl.useProgram(program);
        gl.uniform2f(uniforms.resolution,width,height); gl.uniform2f(uniforms.pointer,pointer.x,pointer.y);
        gl.uniform2f(uniforms.velocity,pointer.vx,pointer.vy); gl.uniform1f(uniforms.motion,motion);
        gl.uniform2f(uniforms.wake,flow.x,flow.y); gl.uniform2f(uniforms.heading,flow.headingX,flow.headingY);
        gl.uniform1f(uniforms.hover,hover);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArraysInstanced(gl.TRIANGLES,0,6,count);
      }
    };
  } catch (error) {
    const replacement=canvas.cloneNode(false);
    canvas.replaceWith(replacement);
    heroField=replacement;
    return null;
  }
}

let gpuField = createGPUField(heroField);
let fieldContext = gpuField ? null : heroField.getContext("2d", { alpha: true });
if (gpuField || fieldContext) {
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const faceArea = hero.querySelector(".hero__portrait");
  const pointer = { x: 0, y: 0, vx: 0, vy: 0, lastTime: 0, active: false };
  const flow = { x: 0, y: 0, vx: 0, vy: 0, headingX: 1, headingY: 0 };
  let fieldWidth = 0;
  let fieldHeight = 0;
  let strokes = [];
  let fieldFrame = 0;
  let fieldLastTime = 0;
  let heroVisible = true;
  let portraitPixels = null;
  let portraitMask = null;
  let portraitLuminance = null;
  const restingField = document.createElement("canvas");
  const restingContext = restingField.getContext("2d");
  const activeStrokes = new Set();
  let gridStep = 7.5;
  let gridColumns = 0;
  let gridRows = 0;
  let pixelRatio = 1;
  let heroPageTop = 0;
  let heroPageLeft = 0;
  let dirtyRegion = null;
  let fieldSignature = "";
  let hoverMix = 0;
  let gpuMotion = 0;
  let arrivalPlayed = false;
  let fieldLost = false;
  heroField.dataset.entrance = reduceMotion.matches ? "complete" : "pending";

  function drawStroke(context, stroke) {
      const angle = stroke.angle + stroke.rotation;
      const halfLength = 2.65;
      const offsetX = Math.cos(angle) * halfLength;
      const offsetY = Math.sin(angle) * halfLength;
      const x = stroke.x + stroke.dx;
      const y = stroke.y + stroke.dy;
      if (stroke.energy > .002) {
        // One shared jewel palette grades the portrait and its cursor light.
        const hue = Math.max(0, Math.min(1, .5 + (stroke.x - pointer.x) / 250 + (stroke.y - pointer.y) / 420));
        const position = Math.min(3.99999, hue * 4);
        const index = Math.floor(position);
        const mix = position - index;
        const first = heroHoverPalette[index], second = heroHoverPalette[index + 1];
        const tone = 1 - stroke.mask + stroke.mask * (.08 + stroke.brightness * .92);
        const red = stroke.red + ((first[0] + (second[0] - first[0]) * mix) * tone - stroke.red) * stroke.energy;
        const green = stroke.green + ((first[1] + (second[1] - first[1]) * mix) * tone - stroke.green) * stroke.energy;
        const blue = stroke.blue + ((first[2] + (second[2] - first[2]) * mix) * tone - stroke.blue) * stroke.energy;
        const alpha = stroke.alpha + (.94 - stroke.alpha) * stroke.energy * (1 - stroke.mask * .65);
        context.strokeStyle = `rgba(${Math.round(red)}, ${Math.round(green)}, ${Math.round(blue)}, ${alpha.toFixed(3)})`;
      } else context.strokeStyle = stroke.color;
      context.beginPath();
      context.moveTo(x - offsetX, y - offsetY);
      context.lineTo(x + offsetX, y + offsetY);
      context.stroke();
  }

  function visitRegion(left, top, right, bottom, visit) {
    const firstColumn = Math.max(0, Math.floor(left / gridStep));
    const lastColumn = Math.min(gridColumns - 1, Math.ceil(right / gridStep));
    const firstRow = Math.max(0, Math.floor(top / gridStep));
    const lastRow = Math.min(gridRows - 1, Math.ceil(bottom / gridStep));
    for (let row = firstRow; row <= lastRow; row++) {
      for (let column = firstColumn; column <= lastColumn; column++) visit(row * gridColumns + column);
    }
  }

  function restoreRegion(region) {
    if (!region) return;
    const { left, top, width, height } = region;
    fieldContext.clearRect(left, top, width, height);
    fieldContext.drawImage(restingField, left * pixelRatio, top * pixelRatio, width * pixelRatio, height * pixelRatio, left, top, width, height);
  }

  function drawField() {
    if (gpuField) {
      gpuField.draw(pointer,gpuMotion,hoverMix,flow);
      return;
    }
    // The dense face is cached. Only the local moving patch is repainted.
    restoreRegion(dirtyRegion);
    dirtyRegion = null;
    if (!activeStrokes.size) return;
    let left = fieldWidth, top = fieldHeight, right = 0, bottom = 0;
    for (const index of activeStrokes) {
      const stroke = strokes[index];
      left = Math.min(left, stroke.x - 44);
      top = Math.min(top, stroke.y - 44);
      right = Math.max(right, stroke.x + 44);
      bottom = Math.max(bottom, stroke.y + 44);
    }
    left = Math.max(0, Math.floor(left));
    top = Math.max(0, Math.floor(top));
    right = Math.min(fieldWidth, Math.ceil(right));
    bottom = Math.min(fieldHeight, Math.ceil(bottom));
    dirtyRegion = { left, top, width: right - left, height: bottom - top };
    fieldContext.save();
    fieldContext.beginPath();
    fieldContext.rect(left, top, right - left, bottom - top);
    fieldContext.clip();
    fieldContext.clearRect(left, top, right - left, bottom - top);
    visitRegion(left - 44, top - 44, right + 44, bottom + 44, index => drawStroke(fieldContext, strokes[index]));
    fieldContext.restore();
  }

  function stopField() {
    window.cancelAnimationFrame(fieldFrame);
    fieldFrame = 0;
    fieldLastTime = 0;
    pointer.active = false;
    heroField.dataset.active="false";
    pointer.vx = pointer.vy = 0;
    hoverMix = gpuMotion = 0;
    flow.vx=flow.vy=0;
    if (reduceMotion.matches) {
      heroField.dataset.entrance="complete";
    }
    for (const index of activeStrokes) {
      const stroke = strokes[index];
      stroke.dx = stroke.dy = stroke.rotation = 0;
      stroke.speedX = stroke.speedY = stroke.speedRotation = 0;
      stroke.energy = 0;
    }
    activeStrokes.clear();
    drawField();
  }

  function animateField(time) {
    fieldFrame = 0;
    if (document.hidden || !heroVisible || reduceMotion.matches || fieldLost || !finePointer.matches) {
      stopField();
      return;
    }
    const elapsed = Math.min((time - (fieldLastTime || time - 16.67)) / 1000, .1);
    const delta = Math.min(elapsed, .032);
    fieldLastTime = time;
    const motionAge = time - pointer.lastTime;
    const motionFade = pointer.active ? Math.exp(-Math.max(0, motionAge - 55) / 135) : 0;
    const velocityX = pointer.vx * motionFade;
    const velocityY = pointer.vy * motionFade;
    const movingPointer = motionFade > .02 && Math.hypot(velocityX, velocityY) > 12;
    if (gpuField) {
      // A damped spring lets the local stroke response follow and settle naturally.
      flow.vx+=((pointer.x-flow.x)*170-flow.vx*24)*delta;
      flow.vy+=((pointer.y-flow.y)*170-flow.vy*24)*delta;
      flow.x+=flow.vx*delta;
      flow.y+=flow.vy*delta;
      const lagX=pointer.x-flow.x, lagY=pointer.y-flow.y;
      const lag=Math.hypot(lagX,lagY);
      if (lag>80) {
        flow.x=pointer.x-lagX/lag*80;
        flow.y=pointer.y-lagY/lag*80;
        flow.vx=Math.max(-1600,Math.min(1600,flow.vx));
        flow.vy=Math.max(-1600,Math.min(1600,flow.vy));
      }
      const springMoving=Math.hypot(pointer.x-flow.x,pointer.y-flow.y)>.08 || Math.hypot(flow.vx,flow.vy)>.08;
      if (!springMoving) { flow.x=pointer.x; flow.y=pointer.y; flow.vx=flow.vy=0; }
      const speed=Math.hypot(pointer.vx,pointer.vy);
      if (speed>12) {
        flow.headingX=pointer.vx/speed;
        flow.headingY=pointer.vy/speed;
      }
      const targetHover = pointer.active ? 1 : 0;
      hoverMix += (targetHover-hoverMix)*(1-Math.exp(-delta*14));
      const transitioning = Math.abs(targetHover-hoverMix)>.002;
      if (!transitioning) hoverMix=targetHover;
      gpuMotion=movingPointer ? motionFade : 0;
      drawField();
      if (movingPointer || transitioning || springMoving) fieldFrame=window.requestAnimationFrame(animateField);
      else fieldLastTime=0;
      return;
    }
    if (pointer.active) {
      visitRegion(pointer.x - 150, pointer.y - 150, pointer.x + 150, pointer.y + 150, index => {
        const stroke = strokes[index];
        const dx = stroke.x - pointer.x, dy = stroke.y - pointer.y;
        if (dx * dx + dy * dy < 22500) activeStrokes.add(index);
      });
    }
    const energyEase = 1 - Math.exp(-delta * 14);
    let unsettled = false;
    for (const index of activeStrokes) {
      const stroke = strokes[index];
      const distance = Math.hypot(stroke.x - pointer.x, stroke.y - pointer.y);
      // The CPU fallback has a fixed local budget, even during long fast drags.
      if (distance > 180) {
        stroke.dx = stroke.dy = stroke.rotation = stroke.energy = 0;
        stroke.speedX = stroke.speedY = stroke.speedRotation = 0;
        activeStrokes.delete(index);
        continue;
      }
      const proximity = Math.max(0, 1 - distance / 150) ** 1.5;
      const influence = movingPointer ? proximity : 0;
      const ripple = Math.sin(distance * .045 - motionAge * .014) * motionFade * influence;
      const targetX = Math.max(-36, Math.min(36, velocityX * .042)) * influence;
      const targetY = Math.max(-36, Math.min(36, velocityY * .042)) * influence;
      const targetRotation = Math.max(-1.1, Math.min(1.1, (velocityX * Math.sin(stroke.angle) - velocityY * Math.cos(stroke.angle)) * .0013)) * influence + ripple * .24;
      const targetEnergy = Math.min(1, Math.hypot(targetX, targetY) / 26 + Math.abs(targetRotation) * .32);
      stroke.energy += (targetEnergy - stroke.energy) * energyEase;
      stroke.speedX += ((targetX - stroke.dx) * 170 - stroke.speedX * 24) * delta;
      stroke.speedY += ((targetY - stroke.dy) * 170 - stroke.speedY * 24) * delta;
      stroke.speedRotation += ((targetRotation - stroke.rotation) * 170 - stroke.speedRotation * 24) * delta;
      stroke.dx += stroke.speedX * delta;
      stroke.dy += stroke.speedY * delta;
      stroke.rotation += stroke.speedRotation * delta;
      const moving = Math.abs(stroke.dx) + Math.abs(stroke.dy) + Math.abs(stroke.rotation) > .015 || Math.abs(stroke.speedX) + Math.abs(stroke.speedY) + Math.abs(stroke.speedRotation) > .08;
      if (moving || Math.abs(targetEnergy - stroke.energy) > .002) unsettled = true;
      else if (targetEnergy < .002) {
        stroke.dx = stroke.dy = stroke.rotation = stroke.energy = 0;
        stroke.speedX = stroke.speedY = stroke.speedRotation = 0;
        activeStrokes.delete(index);
      }
    }
    drawField();
    if (movingPointer || unsettled) fieldFrame = window.requestAnimationFrame(animateField);
    else fieldLastTime = 0;
  }

  function requestFieldFrame() {
    if (!fieldFrame) {
      fieldLastTime = 0;
      fieldFrame = window.requestAnimationFrame(animateField);
    }
  }

  function beginEntrance() {
    if (arrivalPlayed) return;
    arrivalPlayed=true;
    // Fade the finished field on the compositor; no per-frame canvas redraw.
    heroField.dataset.entrance=reduceMotion.matches ? "complete" : "playing";
  }

  function sizeField() {
    const bounds = hero.getBoundingClientRect();
    fieldWidth = Math.round(bounds.width);
    fieldHeight = Math.round(bounds.height);
    if (!fieldWidth || !fieldHeight) return;
    heroPageTop = bounds.top + window.scrollY;
    heroPageLeft = bounds.left + window.scrollX;
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const faceBounds = faceArea?.getBoundingClientRect();
    const signature = [fieldWidth, fieldHeight, pixelRatio, faceBounds?.left - bounds.left, faceBounds?.top - bounds.top, faceBounds?.width, faceBounds?.height, !!portraitPixels].join("/");
    if (signature === fieldSignature) return;
    fieldSignature = signature;
    heroField.width = Math.round(fieldWidth * pixelRatio);
    heroField.height = Math.round(fieldHeight * pixelRatio);
    if (fieldContext) {
      fieldContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      fieldContext.lineWidth = 1.3;
      fieldContext.lineCap = "round";
      restingField.width = heroField.width;
      restingField.height = heroField.height;
      restingContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      restingContext.lineWidth = 1.3;
      restingContext.lineCap = "round";
    }
    const faceHeight = faceBounds ? Math.min(faceBounds.height, faceBounds.width * 1.23) : 0;
    const faceWidth = faceHeight * 182 / 238;
    const faceLeft = faceBounds ? faceBounds.left - bounds.left + (faceBounds.width - faceWidth) / 2 : 0;
    const faceTop = faceBounds ? faceBounds.top - bounds.top + (faceBounds.height - faceHeight) / 2 : 0;
    strokes = [];
    const step = Math.max(7.5, Math.sqrt(fieldWidth * fieldHeight / 24000));
    gridStep = step;
    gridColumns = Math.ceil(fieldWidth / step - .5);
    gridRows = Math.ceil(fieldHeight / step - .5);
    for (let y = step / 2; y < fieldHeight; y += step) {
      for (let x = step / 2; x < fieldWidth; x += step) {
        const horizontal = x / fieldWidth;
        const vertical = y / fieldHeight;
        const u = (x - fieldWidth * .74) / fieldWidth;
        const v = (y - fieldHeight * .52) / fieldHeight;
        let angle = Math.atan2(.18 + u * 2.8 + Math.sin(x * .011) * .25, 1 - v * 2.5 + Math.cos(y * .013) * .2);
        const hue = Math.max(0, Math.min(.99999, .07 + horizontal * .58 + vertical * .23 + Math.sin(x * .004 + y * .003) * .12));
        const colorPosition = hue * 4;
        const colorIndex = Math.floor(colorPosition);
        const colorMix = colorPosition - colorIndex;
        const firstColor = heroPalette[colorIndex], secondColor = heroPalette[colorIndex + 1];
        let red = firstColor[0] + (secondColor[0] - firstColor[0]) * colorMix;
        let green = firstColor[1] + (secondColor[1] - firstColor[1]) * colorMix;
        let blue = firstColor[2] + (secondColor[2] - firstColor[2]) * colorMix;
        let alpha = .31 + .035 * Math.sin(x * .008 + y * .01);
        let mask = 0;
        let brightness = 1;
        if (portraitPixels && portraitMask && faceWidth && x >= faceLeft && x < faceLeft + faceWidth && y >= faceTop && y < faceTop + faceHeight) {
          const sourceX = 108 + (x - faceLeft) / faceWidth * 182;
          const sourceY = 16 + (y - faceTop) / faceHeight * 238;
          const offset = (Math.floor(sourceY) * 400 + Math.floor(sourceX)) * 4;
          const bottomFade = Math.min(1, Math.max(0, (254 - sourceY) / 25));
          const sideFade = Math.max(0, Math.min(1, (sourceX - 108) / 12, (290 - sourceX) / 12));
          mask = portraitMask[offset + 3] / 255 * bottomFade * sideFade;
          // Sample continuous tones; retain small features without pixel stepping.
          const luminance = samplePortrait(sourceX, sourceY);
          const neighborhood = (samplePortrait(sourceX - 4, sourceY) + samplePortrait(sourceX + 4, sourceY) + samplePortrait(sourceX, sourceY - 4) + samplePortrait(sourceX, sourceY + 4)) / 4;
          const detail = luminance + (luminance - neighborhood) * .65;
          brightness = Math.max(0, Math.min(1, (detail - .065) / .61)) ** .86;
          const faceRed = 12 + brightness * 242 * (.84 + .16 * red / 255);
          const faceGreen = 17 + brightness * 231 * (.84 + .16 * green / 255);
          const faceBlue = 27 + brightness * 228 * (.84 + .16 * blue / 255);
          red += (faceRed - red) * mask;
          green += (faceGreen - green) * mask;
          blue += (faceBlue - blue) * mask;
          alpha += (.98 - alpha) * mask;
          const gx = samplePortrait(sourceX + 2, sourceY) - samplePortrait(sourceX - 2, sourceY);
          const gy = samplePortrait(sourceX, sourceY + 2) - samplePortrait(sourceX, sourceY - 2);
          const edge = Math.min(.8, Math.hypot(gx, gy) * 4) * mask;
          const contour = Math.atan2(gx, -gy);
          // Sticks follow real brow, nose, lip and jaw contours at stronger edges.
          angle += Math.atan2(Math.sin(2 * (contour - angle)), Math.cos(2 * (contour - angle))) * .5 * edge;
        }
        strokes.push({ x, y, angle, red, green, blue, alpha, mask, brightness, energy: 0, color: `rgba(${Math.round(red)}, ${Math.round(green)}, ${Math.round(blue)}, ${alpha.toFixed(3)})`, dx: 0, dy: 0, rotation: 0, speedX: 0, speedY: 0, speedRotation: 0 });
      }
    }
    window.cancelAnimationFrame(fieldFrame);
    fieldFrame = 0;
    fieldLastTime = 0;
    activeStrokes.clear();
    dirtyRegion = null;
    if (gpuField) {
      gpuField.upload(strokes,fieldWidth,fieldHeight);
      drawField();
    } else {
      heroField.dataset.renderer="canvas";
      for (const stroke of strokes) drawStroke(restingContext, stroke);
      fieldContext.drawImage(restingField, 0, 0, fieldWidth, fieldHeight);
    }
    if (pointer.active) requestFieldFrame();
  }

  function samplePortrait(x, y) {
    x = Math.max(0, Math.min(398, x));
    y = Math.max(0, Math.min(398, y));
    const left = Math.floor(x), top = Math.floor(y);
    const fx = x - left, fy = y - top;
    const index = top * 400 + left;
    const upper = portraitLuminance[index] * (1 - fx) + portraitLuminance[index + 1] * fx;
    const lower = portraitLuminance[index + 400] * (1 - fx) + portraitLuminance[index + 401] * fx;
    return upper * (1 - fy) + lower * fy;
  }

  const portraitSource = new Image();
  portraitSource.addEventListener("load", () => {
    const samplingCanvas = document.createElement("canvas");
    samplingCanvas.width = samplingCanvas.height = 400;
    const samplingContext = samplingCanvas.getContext("2d", { willReadFrequently: true });
    if (!samplingContext) return;
    samplingContext.drawImage(portraitSource, 0, 0, 400, 400);
    portraitPixels = samplingContext.getImageData(0, 0, 400, 400).data;
    portraitLuminance = new Float32Array(400 * 400);
    for (let index = 0; index < portraitLuminance.length; index++) {
      const offset = index * 4;
      portraitLuminance[index] = (portraitPixels[offset] * .2126 + portraitPixels[offset + 1] * .7152 + portraitPixels[offset + 2] * .0722) / 255;
    }
    samplingContext.clearRect(0, 0, 400, 400);
    samplingContext.filter = "blur(5px)";
    const outline = [[195,27],[225,24],[253,35],[268,57],[270,89],[261,116],[266,135],[262,166],[255,178],[250,202],[249,223],[268,238],[309,251],[350,265],[361,291],[389,400],[20,400],[30,331],[41,281],[52,269],[94,251],[131,238],[157,222],[158,207],[146,185],[139,170],[134,149],[132,131],[125,104],[126,80],[138,57],[162,39]];
    samplingContext.beginPath();
    outline.forEach(([x, y], index) => index ? samplingContext.lineTo(x, y) : samplingContext.moveTo(x, y));
    samplingContext.closePath();
    samplingContext.fillStyle = "white";
    samplingContext.fill();
    portraitMask = samplingContext.getImageData(0, 0, 400, 400).data;
    sizeField();
    beginEntrance();
  });
  portraitSource.addEventListener("error", beginEntrance);
  portraitSource.src = "assets/prabhas-linkedin.jpg";
  heroField.addEventListener("animationend", event => {
    if (event.animationName==="field-arrival") {
      heroField.dataset.entrance="complete";
    }
  });

  function moveFieldPointer(event) {
    if (!finePointer.matches || reduceMotion.matches || event.pointerType === "touch" || !heroVisible) return;
    const x = event.clientX + window.scrollX - heroPageLeft;
    const y = event.clientY + window.scrollY - heroPageTop;
    const time = performance.now();
    const entering = !pointer.active;
    const elapsed = Math.max(8, Math.min(80, time - pointer.lastTime));
    if (pointer.active && time - pointer.lastTime < 180) {
      const nextVX = Math.max(-1600, Math.min(1600, (x - pointer.x) / elapsed * 1000));
      const nextVY = Math.max(-1600, Math.min(1600, (y - pointer.y) / elapsed * 1000));
      pointer.vx += (nextVX - pointer.vx) * .65;
      pointer.vy += (nextVY - pointer.vy) * .65;
    } else pointer.vx = pointer.vy = 0;
    pointer.x = x;
    pointer.y = y;
    pointer.lastTime = time;
    pointer.active = true;
    if (entering) heroField.dataset.active="true";
    if (entering) { flow.x=x; flow.y=y; flow.vx=flow.vy=0; }
    if (entering && gpuField) hoverMix = 1;
    requestFieldFrame();
  }
  hero.addEventListener("pointerenter", moveFieldPointer, { passive: true });
  hero.addEventListener("pointermove", moveFieldPointer, { passive: true });
  function releaseField() {
    pointer.active = false;
    heroField.dataset.active="false";
    pointer.vx = pointer.vy = 0;
    if (reduceMotion.matches || !finePointer.matches) stopField();
    else requestFieldFrame();
  }
  hero.addEventListener("pointerleave", releaseField);
  hero.addEventListener("pointercancel", releaseField);
  window.addEventListener("blur", releaseField);
  reduceMotion.addEventListener("change", stopField);
  finePointer.addEventListener("change", stopField);
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopField(); });
  if ("ResizeObserver" in window) {
    const fieldObserver = new ResizeObserver(sizeField);
    fieldObserver.observe(hero);
    if (faceArea) fieldObserver.observe(faceArea);
  } else window.addEventListener("resize", sizeField);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(entries => {
      heroVisible = entries[0].isIntersecting;
      if (!heroVisible) stopField();
    }).observe(hero);
  }
  document.fonts?.ready.then(sizeField);
  heroField.addEventListener("webglcontextlost", event => { event.preventDefault(); fieldLost=true; stopField(); });
  heroField.addEventListener("webglcontextrestored", () => {
    fieldLost=false;
    gpuField=createGPUField(heroField);
    if (!gpuField) fieldContext=heroField.getContext("2d", { alpha: true });
    fieldSignature="";
    sizeField();
  });
  sizeField();
}
const revealNodes = document.querySelectorAll(".reveal");
revealNodes.forEach(node => {
  const group = node.closest(".project-grid, .approach__principles");
  if (!group) return;
  const item = node.closest(".project") || node;
  const index = Array.from(group.children).indexOf(item);
  if (index > 0) node.style.setProperty("--reveal-delay", `${Math.min(index * 110, 330)}ms`);
});
if ("IntersectionObserver" in window && !reduceMotion.matches) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }
  }, { rootMargin: "0px 0px -7% 0px", threshold: 0.08 });
  revealNodes.forEach(node => revealObserver.observe(node));
} else {
  revealNodes.forEach(node => node.classList.add("is-visible"));
}

const navLinks = document.querySelectorAll(".desktop-nav a[data-nav]");
if ("IntersectionObserver" in window) {
  const sectionObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      navLinks.forEach(link => link.classList.toggle("is-active", link.dataset.nav === entry.target.id));
    }
  }, { rootMargin: "-28% 0px -62% 0px" });
  ["work", "approach", "about", "contact"].forEach(id => sectionObserver.observe(document.getElementById(id)));
}

const menuToggle = document.querySelector(".menu-toggle");
const mobileMenu = document.getElementById("mobile-menu");
function setMenu(open) {
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  mobileMenu.hidden = !open;
}
menuToggle.addEventListener("click", () => setMenu(menuToggle.getAttribute("aria-expanded") !== "true"));
mobileMenu.querySelectorAll("a").forEach(link => link.addEventListener("click", () => setMenu(false)));
document.addEventListener("click", event => {
  if (!mobileMenu.hidden && !header.contains(event.target)) setMenu(false);
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !mobileMenu.hidden) {
    setMenu(false);
    menuToggle.focus();
  }
});
window.addEventListener("resize", () => {
  if (window.innerWidth > 760 && !mobileMenu.hidden) setMenu(false);
});
