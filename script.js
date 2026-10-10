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
const heroPalette = [[191, 133, 94], [222, 175, 133], [243, 215, 179], [167, 186, 199], [109, 143, 163]];
const heroHoverPalette = [[207, 151, 107], [233, 191, 146], [255, 229, 190], [183, 201, 214], [134, 166, 184]];
const HERO_MOTION = Object.freeze({
  revealDuration: 480,
  revealScale: 1.6,
  revealInner: .25,
  revealOuter: 1.35,
  pixelRatioCap: 1.5,
  maxStrokes: 24000,
  idleFrameInterval: 32
});

function heroInfluenceRadius(width,height) {
  return Math.max(48,Math.min(92,Math.min(width,height)*.095));
}

// A small, fixed velocity grid carries the wake; the dense stroke grid stays static.
// Advection transports momentum, diffusion joins adjacent currents, drag settles them.
function createLiquidFlow() {
  const columns=48, rows=32;
  let read=new Float32Array(columns*rows*4), write=new Float32Array(read.length);
  let width=1, height=1;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function sample(data,x,y,channel) {
    x=clamp(x,0,columns-1); y=clamp(y,0,rows-1);
    const left=Math.floor(x), top=Math.floor(y), right=Math.min(left+1,columns-1), bottom=Math.min(top+1,rows-1);
    const fx=x-left, fy=y-top, a=(top*columns+left)*4+channel, b=(top*columns+right)*4+channel;
    const c=(bottom*columns+left)*4+channel, d=(bottom*columns+right)*4+channel;
    return (data[a]+(data[b]-data[a])*fx)*(1-fy)+(data[c]+(data[d]-data[c])*fx)*fy;
  }
  return {
    columns, rows,
    get data(){return read;},
    resize(w,h){width=w; height=h; read.fill(0); write.fill(0);},
    clear(){read.fill(0); write.fill(0);},
    at(x,y,channel){return sample(read,x/width*(columns-1),y/height*(rows-1),channel);},
    stir(fromX,fromY,toX,toY,vx,vy) {
      const speed=Math.hypot(vx,vy);
      if(speed<8) return;
      const radius=heroInfluenceRadius(width,height);
      const steps=Math.min(10,Math.max(1,Math.ceil(Math.hypot(toX-fromX,toY-fromY)/(radius*.45))));
      const strength=Math.min(1,speed/450);
      for(let step=1;step<=steps;step++) {
        const px=fromX+(toX-fromX)*step/steps, py=fromY+(toY-fromY)*step/steps;
        const left=Math.max(0,Math.floor((px-radius*2)/width*(columns-1)));
        const right=Math.min(columns-1,Math.ceil((px+radius*2)/width*(columns-1)));
        const top=Math.max(0,Math.floor((py-radius*2)/height*(rows-1)));
        const bottom=Math.min(rows-1,Math.ceil((py+radius*2)/height*(rows-1)));
        for(let y=top;y<=bottom;y++) for(let x=left;x<=right;x++) {
          const qx=(x/(columns-1)*width-px)/radius, qy=(y/(rows-1)*height-py)/radius;
          const weight=Math.exp(-(qx*qx+qy*qy)*1.8);
          if(weight<.008) continue;
          const cross=vx*qy-vy*qx, index=(y*columns+x)*4;
          read[index]=clamp(read[index]+(vx-3.6*cross*qy)*weight*.16/steps,-500,500);
          read[index+1]=clamp(read[index+1]+(vy+3.6*cross*qx)*weight*.16/steps,-500,500);
          read[index+2]=Math.min(1,read[index+2]+weight*(.12+strength*.32)/steps);
        }
      }
    },
    advance(dt) {
      const drag=Math.exp(-dt*4.2), fade=Math.exp(-dt*2.2), diffusion=Math.min(.18,dt*4);
      let energy=0;
      for(let y=0;y<rows;y++) for(let x=0;x<columns;x++) {
        const index=(y*columns+x)*4;
        const bx=x-read[index]*dt/width*(columns-1), by=y-read[index+1]*dt/height*(rows-1);
        const left=(y*columns+Math.max(0,x-1))*4, right=(y*columns+Math.min(columns-1,x+1))*4;
        const top=(Math.max(0,y-1)*columns+x)*4, bottom=(Math.min(rows-1,y+1)*columns+x)*4;
        for(let c=0;c<3;c++) {
          const transported=sample(read,bx,by,c);
          const neighbors=(read[left+c]+read[right+c]+read[top+c]+read[bottom+c])*.25;
          let value=(transported+(neighbors-transported)*diffusion)*(c===2?fade:drag);
          if(Math.abs(value)<(c===2?.0005:.025)) value=0;
          write[index+c]=value;
          energy=Math.max(energy,c===2?value:Math.abs(value)/500);
        }
      }
      const swap=read; read=write; write=swap;
      return energy;
    }
  };
}

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
      layout(location=4) in vec3 photoColor;
      uniform vec2 resolution, gridExtent;
      uniform vec2 portraitPointer;
      uniform float hover, phase, portraitReveal;
      uniform float portraitRadius;
      uniform sampler2D ink, flowTexture;
      out vec2 local;
      out vec4 color;
      vec3 spectrum(float hue) {
        vec3 amber=vec3(207.,151.,107.)/255.;
        vec3 rose=vec3(233.,191.,146.)/255.;
        vec3 violet=vec3(255.,229.,190.)/255.;
        vec3 blue=vec3(183.,201.,214.)/255.;
        vec3 ice=vec3(134.,166.,184.)/255.;
        if(hue<.25) return mix(amber,rose,hue*4.);
        if(hue<.5) return mix(rose,violet,(hue-.25)*4.);
        if(hue<.75) return mix(violet,blue,(hue-.5)*4.);
        return mix(blue,ice,(hue-.75)*4.);
      }
      vec3 currentAt(vec2 uv) {
        vec2 p=clamp(uv,0.,1.)*vec2(47.,31.);
        ivec2 a=ivec2(floor(p)), b=min(a+ivec2(1),ivec2(47,31));
        vec2 f=fract(p);
        return mix(mix(texelFetch(flowTexture,a,0).xyz,texelFetch(flowTexture,ivec2(b.x,a.y),0).xyz,f.x),
                   mix(texelFetch(flowTexture,ivec2(a.x,b.y),0).xyz,texelFetch(flowTexture,b,0).xyz,f.x),f.y);
      }
      void main() {
        vec2 uv=origin.xy/resolution;
        vec3 flow=currentAt(uv);
        float speed=length(flow.xy);
        float subject=smoothstep(.01,.7,face.x);
        float backgroundMotion=1.-subject;
        vec2 displacement=flow.xy*.055;
        displacement/=1.+length(displacement)/22.;
        // The subject stays fixed; only the surrounding field carries the wake.
        displacement*=backgroundMotion;
        vec4 resting=texture(ink,origin.xy/gridExtent);
        vec4 advected=texture(ink,(origin.xy-displacement)/gridExtent);
        float activity=clamp(flow.z*1.4+speed/400.,0.,1.);
        float turn=atan(flow.y+.00001,flow.x+.00001)-origin.z;
        float nearestTurn=atan(sin(turn*2.),cos(turn*2.))*.5;
        float idleTurn=sin(uv.x*6.+uv.y*4.-phase*.24)*.035*hover;
        float angle=origin.z+(nearestTurn*smoothstep(4.,150.,speed)*.82+idleTurn)*backgroundMotion;
        local=corner*vec2(4.,1.7);
        vec2 rotated=vec2(cos(angle)*local.x-sin(angle)*local.y,sin(angle)*local.x+cos(angle)*local.y);
        vec2 position=origin.xy+rotated;
        gl_Position=vec4(position.x/resolution.x*2.-1.,1.-position.y/resolution.y*2.,0.,1.);
        float hue=clamp(.12+uv.x*.56+uv.y*.16+sin(phase*.3+uv.y*3.-uv.x*2.)*.13-dot(displacement,vec2(.003,.002)),0.,1.);
        float tone=1.-face.x+face.x*(.08+face.y*.92);
        vec4 inkColor=mix(resting,advected,smoothstep(.1,3.,length(displacement)));
        float tint=(.07*hover+activity*.28)*(1.-face.x*.62)*backgroundMotion;
        vec3 graded=mix(inkColor.rgb,spectrum(hue)*tone,tint);
        float distanceRatio=length(origin.xy-portraitPointer)/portraitRadius;
        float proximity=1.-smoothstep(${HERO_MOTION.revealInner.toFixed(2)},${HERO_MOTION.revealOuter.toFixed(2)},distanceRatio);
        color=vec4(mix(graded,photoColor,portraitReveal*face.x*proximity),inkColor.a+activity*.14*(1.-face.x)*backgroundMotion);
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
    for (const [location,size,offset] of [[1,3,0],[2,4,12],[3,2,28],[4,3,36]]) {
      gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location,size,gl.FLOAT,false,48,offset); gl.vertexAttribDivisor(location,1);
    }
    const uniforms=Object.fromEntries(["resolution","gridExtent","hover","phase","ink","flowTexture","portraitReveal","portraitPointer","portraitRadius"].map(name=>[name,gl.getUniformLocation(program,name)]));
    const inkTexture=gl.createTexture(), flowTexture=gl.createTexture();
    for(const texture of [inkTexture,flowTexture]) {
      gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,texture===inkTexture?gl.LINEAR:gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,texture===inkTexture?gl.LINEAR:gl.NEAREST);
    }
    gl.bindTexture(gl.TEXTURE_2D,flowTexture);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,48,32,0,gl.RGBA,gl.FLOAT,new Float32Array(48*32*4));
    gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0,0,0,0);
    let count=0, width=1, height=1, extentX=1, extentY=1;
    canvas.dataset.renderer="gpu";
    return {
      upload(strokes, nextWidth, nextHeight, columns, rows, step) {
        width=nextWidth; height=nextHeight; count=strokes.length;
        const data=new Float32Array(count*12);
        strokes.forEach((stroke,index)=>data.set([stroke.x,stroke.y,stroke.angle,stroke.red/255,stroke.green/255,stroke.blue/255,stroke.alpha,stroke.mask,stroke.brightness,stroke.photoRed/255,stroke.photoGreen/255,stroke.photoBlue/255],index*12));
        gl.bindBuffer(gl.ARRAY_BUFFER,instances); gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
        extentX=columns*step; extentY=rows*step;
        const tones=new Uint8Array(columns*rows*4);
        strokes.forEach((stroke,index)=>tones.set([stroke.red,stroke.green,stroke.blue,stroke.alpha*255],index*4));
        gl.bindTexture(gl.TEXTURE_2D,inkTexture);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,columns,rows,0,gl.RGBA,gl.UNSIGNED_BYTE,tones);
        gl.viewport(0,0,canvas.width,canvas.height);
      },
      draw(hover, phase, liquid, reveal, portraitPoint, radius) {
        if(gl.isContextLost()) return;
        gl.useProgram(program);
        gl.uniform2f(uniforms.resolution,width,height);
        gl.uniform2f(uniforms.gridExtent,extentX,extentY);
        gl.uniform1f(uniforms.hover,hover); gl.uniform1f(uniforms.phase,phase);
        gl.uniform1f(uniforms.portraitReveal,reveal);
        gl.uniform2f(uniforms.portraitPointer,portraitPoint.x,portraitPoint.y);
        gl.uniform1f(uniforms.portraitRadius,radius);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,inkTexture); gl.uniform1i(uniforms.ink,0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,flowTexture); gl.uniform1i(uniforms.flowTexture,1);
        gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,48,32,gl.RGBA,gl.FLOAT,liquid.data);
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
  const liquid=createLiquidFlow();
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  let touchPointerId = null;
  const faceArea = hero.querySelector(".hero__portrait");
  const pointer = { x: 0, y: 0, vx: 0, vy: 0, lastTime: 0, active: false };
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
  let fieldPhase = 0;
  let fieldLastPaint = 0;
  let arrivalPlayed = false;
  let fieldLost = false;
  let portraitHover = false;
  let fieldReleasedAt = 0;
  let portraitReveal = 0;
  let revealFrom = 0;
  let revealStarted = 0;
  const portraitPoint={x:0,y:0};
  let portraitRadius=60;
  heroField.dataset.entrance = reduceMotion.matches ? "complete" : "pending";

  function drawStroke(context, stroke) {
      const subject = Math.max(0, Math.min(1, (stroke.mask - .01) / .69));
      const backgroundMotion = 1 - subject * subject * (3 - 2 * subject);
      const angle = stroke.angle + stroke.rotation * backgroundMotion;
      const halfLength = 2.65;
      const offsetX = Math.cos(angle) * halfLength;
      const offsetY = Math.sin(angle) * halfLength;
      const x = stroke.x;
      const y = stroke.y;
      let redBase=stroke.red, greenBase=stroke.green, blueBase=stroke.blue, alphaBase=stroke.alpha;
      if(Math.hypot(stroke.dx,stroke.dy)>.1) {
        const gx=Math.max(0,Math.min(gridColumns-1,(stroke.x-stroke.dx)/gridStep-.5));
        const gy=Math.max(0,Math.min(gridRows-1,(stroke.y-stroke.dy)/gridStep-.5));
        const cx=Math.floor(gx),cy=Math.floor(gy),fx=gx-cx,fy=gy-cy;
        const a=strokes[cy*gridColumns+cx],b=strokes[cy*gridColumns+Math.min(cx+1,gridColumns-1)];
        const c=strokes[Math.min(cy+1,gridRows-1)*gridColumns+cx],d=strokes[Math.min(cy+1,gridRows-1)*gridColumns+Math.min(cx+1,gridColumns-1)];
        const blend=key=>(a[key]+(b[key]-a[key])*fx)*(1-fy)+(c[key]+(d[key]-c[key])*fx)*fy;
        redBase=blend('red');greenBase=blend('green');blueBase=blend('blue');alphaBase=blend('alpha');
      }
      let red=redBase,green=greenBase,blue=blueBase,alpha=alphaBase;
      if (stroke.energy > .002) {
        // Shared metallic grading; the portrait keeps natural photo colors.
        const current=stroke.x*.0018+stroke.y*.0022+fieldPhase*.32;
        const eddy=Math.sin(stroke.y*.0035-fieldPhase*.23)+Math.cos(stroke.x*.0028+fieldPhase*.19);
        const hue=.5+.5*Math.sin(current+eddy*.55-stroke.dx*.025-stroke.dy*.02);
        const position = Math.min(3.99999, hue * 4);
        const index = Math.floor(position);
        const mix = position - index;
        const first = heroHoverPalette[index], second = heroHoverPalette[index + 1];
        const tone = 1 - stroke.mask + stroke.mask * (.08 + stroke.brightness * .92);
        const energy=stroke.energy*backgroundMotion;
        red += ((first[0] + (second[0] - first[0]) * mix) * tone - redBase) * energy;
        green += ((first[1] + (second[1] - first[1]) * mix) * tone - greenBase) * energy;
        blue += ((first[2] + (second[2] - first[2]) * mix) * tone - blueBase) * energy;
        alpha += (.52 - alphaBase) * energy * (1 - stroke.mask);
      }
      const distance=Math.hypot(stroke.x-portraitPoint.x,stroke.y-portraitPoint.y);
      const distanceRatio=distance/portraitRadius;
      const feather=Math.max(0,Math.min(1,(distanceRatio-HERO_MOTION.revealInner)/(HERO_MOTION.revealOuter-HERO_MOTION.revealInner)));
      const reveal=portraitReveal*stroke.mask*(1-feather*feather*(3-2*feather));
      red+=(stroke.photoRed-red)*reveal;
      green+=(stroke.photoGreen-green)*reveal;
      blue+=(stroke.photoBlue-blue)*reveal;
      context.strokeStyle=stroke.energy>.002||reveal>.0001 ? `rgba(${Math.round(red)}, ${Math.round(green)}, ${Math.round(blue)}, ${alpha.toFixed(3)})` : stroke.color;
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
      gpuField.draw(hoverMix,fieldPhase,liquid,portraitReveal,portraitPoint,portraitRadius);
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
    fieldLastPaint = 0;
    pointer.active = false;
    heroField.dataset.active="false";
    pointer.vx = pointer.vy = 0;
    hoverMix = 0;
    portraitHover = false;
    portraitReveal = revealFrom = 0;
    heroField.dataset.portraitHover="false";
    liquid.clear();
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
    fieldFrame=0;
    if(document.hidden||!heroVisible||reduceMotion.matches||fieldLost) {stopField();return;}
    // Keep active input responsive; an idle pointer needs fewer identical redraws.
    if(gpuField&&pointer.active&&time-pointer.lastTime>160&&fieldLastTime&&time-fieldLastTime<HERO_MOTION.idleFrameInterval) {
      fieldFrame=window.requestAnimationFrame(animateField);
      return;
    }
    const dt=Math.min((time-(fieldLastTime||time-16.67))/1000,.035);
    fieldLastTime=time;
    const revealTarget=portraitHover?1:0;
    const revealProgress=Math.min(1,Math.max(0,(time-revealStarted)/HERO_MOTION.revealDuration));
    const eased=revealProgress*revealProgress*(3-2*revealProgress);
    portraitReveal=revealFrom+(revealTarget-revealFrom)*eased;
    const revealMoving=revealProgress<1&&Math.abs(revealTarget-revealFrom)>.0001;
    // Bound the trailing work in real time, even in a throttled browser pane.
    if (!pointer.active && fieldReleasedAt && time - fieldReleasedAt > 2400) liquid.clear();
    const wakeEnergy=liquid.advance(dt);
    const target=pointer.active?1:0;
    hoverMix+=(target-hoverMix)*(1-Math.exp(-dt*7));
    if(Math.abs(target-hoverMix)<.002) hoverMix=target;
    fieldPhase+=dt*hoverMix;
    if(gpuField) drawField();
    else {
      if(pointer.active&&fieldLastPaint&&time-fieldLastPaint<32) {
        fieldFrame=window.requestAnimationFrame(animateField);
        return;
      }
      fieldLastPaint=time;
      // Bounded fallback: only cells close to the current input are repainted.
      if(pointer.active) visitRegion(pointer.x-150,pointer.y-150,pointer.x+150,pointer.y+150,index=>activeStrokes.add(index));
      if(portraitReveal>0||revealMoving) addPortraitPatch();
      for(const index of activeStrokes) {
        const stroke=strokes[index];
        const vx=liquid.at(stroke.x,stroke.y,0),vy=liquid.at(stroke.x,stroke.y,1),heat=liquid.at(stroke.x,stroke.y,2);
        const speed=Math.hypot(vx,vy),amount=Math.min(1,speed/150);
        const turn=Math.atan2(vy+.00001,vx+.00001)-stroke.angle;
        stroke.rotation=Math.atan2(Math.sin(turn*2),Math.cos(turn*2))*.5*amount*.82;
        const subject=Math.max(0,Math.min(1,(stroke.mask-.01)/.69));
        const grip=1-subject*subject*(3-2*subject);
        const limit=1+speed*.055/22;
        stroke.dx=vx*.055/limit*grip; stroke.dy=vy*.055/limit*grip;
        stroke.energy=Math.min(1,heat*1.4+speed/400)*.28;
        const inReveal=stroke.mask>.001&&(portraitReveal>0||revealMoving)&&Math.hypot(stroke.x-portraitPoint.x,stroke.y-portraitPoint.y)<portraitRadius*HERO_MOTION.revealOuter+gridStep;
        if(!inReveal&&(Math.hypot(stroke.x-pointer.x,stroke.y-pointer.y)>185||(!pointer.active&&speed<.1&&heat<.001))) {
          stroke.rotation=stroke.dx=stroke.dy=stroke.energy=0; activeStrokes.delete(index);
        }
      }
      drawField();
    }
    if(pointer.active||hoverMix>0||wakeEnergy>.0005||revealMoving) fieldFrame=window.requestAnimationFrame(animateField);
    else {fieldLastTime=0;fieldLastPaint=0;}
  }

  function requestFieldFrame() {
    if(!fieldFrame&&!document.hidden&&heroVisible&&!reduceMotion.matches&&!fieldLost) fieldFrame=window.requestAnimationFrame(animateField);
  }

  function beginEntrance() {
    if (["booting", "waiting", "leaving"].includes(document.documentElement.dataset.entry)) return;
    if (!portraitSource.complete) return;
    if (arrivalPlayed) return;
    arrivalPlayed=true;
    // Fade the finished field on the compositor; no per-frame canvas redraw.
    heroField.dataset.entrance=reduceMotion.matches ? "complete" : "playing";
  }
  window.addEventListener("portfolio:enter", beginEntrance);

  function sizeField() {
    const bounds = hero.getBoundingClientRect();
    fieldWidth = Math.round(bounds.width);
    fieldHeight = Math.round(bounds.height);
    if (!fieldWidth || !fieldHeight) return;
    heroPageTop = bounds.top + window.scrollY;
    heroPageLeft = bounds.left + window.scrollX;
    pixelRatio = Math.min(window.devicePixelRatio || 1, HERO_MOTION.pixelRatioCap);
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
    // Give the visible color response a wider core than the liquid force kernel.
    portraitRadius=heroInfluenceRadius(fieldWidth,fieldHeight)*HERO_MOTION.revealScale;
    const faceLeft = faceBounds ? faceBounds.left - bounds.left + (faceBounds.width - faceWidth) / 2 : 0;
    const faceTop = faceBounds ? faceBounds.top - bounds.top + (faceBounds.height - faceHeight) / 2 : 0;
    strokes = [];
    const step = Math.max(7.5, Math.sqrt(fieldWidth * fieldHeight / HERO_MOTION.maxStrokes));
    gridStep = step;
    gridColumns = Math.ceil(fieldWidth / step - .5);
    gridRows = Math.ceil(fieldHeight / step - .5);
    for (let y = step / 2; y < fieldHeight; y += step) {
      for (let x = step / 2; x < fieldWidth; x += step) {
        const horizontal = x / fieldWidth;
        const vertical = y / fieldHeight;
        const u = (x - fieldWidth * .74) / fieldWidth;
        const v = (y - fieldHeight * .52) / fieldHeight;
        let angle = .48 + Math.atan2(u * 1.8 + Math.sin(y * .004) * .32, 1 - v * 1.2);
        const hue = Math.max(0, Math.min(.99999, .07 + horizontal * .58 + vertical * .23 + Math.sin(x * .004 + y * .003) * .12));
        const colorPosition = hue * 4;
        const colorIndex = Math.floor(colorPosition);
        const colorMix = colorPosition - colorIndex;
        const firstColor = heroPalette[colorIndex], secondColor = heroPalette[colorIndex + 1];
        let red = firstColor[0] + (secondColor[0] - firstColor[0]) * colorMix;
        let green = firstColor[1] + (secondColor[1] - firstColor[1]) * colorMix;
        let blue = firstColor[2] + (secondColor[2] - firstColor[2]) * colorMix;
        let alpha = .28 + .035 * horizontal + .025 * Math.sin(x * .003 + y * .004);
        let mask = 0;
        let brightness = 1;
        let photoRed=red,photoGreen=green,photoBlue=blue;
        if (portraitPixels && portraitMask && faceWidth && x >= faceLeft && x < faceLeft + faceWidth && y >= faceTop && y < faceTop + faceHeight) {
          const sourceX = 108 + (x - faceLeft) / faceWidth * 182;
          const sourceY = 16 + (y - faceTop) / faceHeight * 238;
          const offset = (Math.floor(sourceY) * 400 + Math.floor(sourceX)) * 4;
          const bottomFade = Math.min(1, Math.max(0, (254 - sourceY) / 25));
          const sideFade = Math.max(0, Math.min(1, (sourceX - 108) / 12, (290 - sourceX) / 12));
          mask = portraitMask[offset + 3] / 255 * bottomFade * sideFade;
          photoRed=samplePortraitColor(sourceX,sourceY,0);
          photoGreen=samplePortraitColor(sourceX,sourceY,1);
          photoBlue=samplePortraitColor(sourceX,sourceY,2);
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
        strokes.push({ x, y, angle, red, green, blue, alpha, mask, brightness, photoRed, photoGreen, photoBlue, energy: 0, color: `rgba(${Math.round(red)}, ${Math.round(green)}, ${Math.round(blue)}, ${alpha.toFixed(3)})`, dx: 0, dy: 0, rotation: 0, speedX: 0, speedY: 0, speedRotation: 0 });
      }
    }
    window.cancelAnimationFrame(fieldFrame);
    fieldFrame = 0;
    fieldLastTime = 0;
    activeStrokes.clear();
    dirtyRegion = null;
    if (gpuField) {
      liquid.resize(fieldWidth,fieldHeight);
      gpuField.upload(strokes,fieldWidth,fieldHeight,gridColumns,gridRows,gridStep);
      drawField();
    } else {
      liquid.resize(fieldWidth,fieldHeight);
      heroField.dataset.renderer="canvas";
      const currentReveal=portraitReveal;
      portraitReveal=0;
      for (const stroke of strokes) drawStroke(restingContext, stroke);
      portraitReveal=currentReveal;
      fieldContext.drawImage(restingField, 0, 0, fieldWidth, fieldHeight);
      if(portraitReveal>0) {
        addPortraitPatch();
        drawField();
      }
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

  function samplePortraitColor(x,y,channel) {
    x=Math.max(0,Math.min(398,x));y=Math.max(0,Math.min(398,y));
    const left=Math.floor(x),top=Math.floor(y),fx=x-left,fy=y-top;
    const index=(top*400+left)*4+channel;
    const upper=portraitPixels[index]*(1-fx)+portraitPixels[index+4]*fx;
    const lower=portraitPixels[index+1600]*(1-fx)+portraitPixels[index+1604]*fx;
    return upper*(1-fy)+lower*fy;
  }

  function setPortraitHover(next) {
    if(next===portraitHover) return;
    revealFrom=portraitReveal;
    revealStarted=performance.now();
    portraitHover=next;
    heroField.dataset.portraitHover=String(next);
    if(reduceMotion.matches) {
      portraitReveal=next?1:0;
    } else requestFieldFrame();
  }

  function addPortraitPatch() {
    const extent=portraitRadius*HERO_MOTION.revealOuter;
    visitRegion(portraitPoint.x-extent,portraitPoint.y-extent,portraitPoint.x+extent,portraitPoint.y+extent,index=>activeStrokes.add(index));
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
    if (!heroVisible || (event.pointerType === "touch" && event.pointerId !== touchPointerId)) return;
    const x = event.clientX + window.scrollX - heroPageLeft;
    const y = event.clientY + window.scrollY - heroPageTop;
    const column=Math.round(x/gridStep-.5),row=Math.round(y/gridStep-.5);
    const hit=column>=0&&column<gridColumns&&row>=0&&row<gridRows ? strokes[row*gridColumns+column] : null;
    const onPortrait=!!hit&&hit.mask>(portraitHover ? .06 : .16);
    if(onPortrait) {portraitPoint.x=x;portraitPoint.y=y;}
    setPortraitHover(onPortrait);
    if(reduceMotion.matches) {
      if(!gpuField&&portraitReveal>0) addPortraitPatch();
      drawField();
      activeStrokes.clear();
      return;
    }
    const time = performance.now();
    const entering = !pointer.active;
    const elapsed = Math.max(8, Math.min(80, time - pointer.lastTime));
    if (pointer.active && time - pointer.lastTime < 180) {
      const nextVX = Math.max(-1600, Math.min(1600, (x - pointer.x) / elapsed * 1000));
      const nextVY = Math.max(-1600, Math.min(1600, (y - pointer.y) / elapsed * 1000));
      pointer.vx += (nextVX - pointer.vx) * .65;
      pointer.vy += (nextVY - pointer.vy) * .65;
    } else pointer.vx = pointer.vy = 0;
    if(!entering) liquid.stir(pointer.x,pointer.y,x,y,pointer.vx,pointer.vy);
    pointer.x = x;
    pointer.y = y;
    pointer.lastTime = time;
    pointer.active = true;
    fieldReleasedAt = 0;
    if (entering) heroField.dataset.active="true";
    requestFieldFrame();
  }
  hero.addEventListener("pointerenter", moveFieldPointer, { passive: true });
  hero.addEventListener("pointermove", moveFieldPointer, { passive: true });
  hero.addEventListener("pointerdown", event => {
    if (event.pointerType !== "touch" || !event.isPrimary || event.target.closest("a,button,summary,input")) return;
    touchPointerId = event.pointerId;
    heroField.dataset.input = "touch";
    moveFieldPointer(event);
  }, { passive: true });
  function releaseField() {
    fieldReleasedAt = performance.now();
    touchPointerId = null;
    setPortraitHover(false);
    pointer.active = false;
    heroField.dataset.active="false";
    pointer.vx = pointer.vy = 0;
    if (reduceMotion.matches) stopField();
    else requestFieldFrame();
  }
  hero.addEventListener("pointerup", event => {
    if (event.pointerId === touchPointerId) releaseField();
  });
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
      navLinks.forEach(link => {
        const current=link.dataset.nav===entry.target.id;
        link.classList.toggle("is-active",current);
        if(current) link.setAttribute("aria-current","location");
        else link.removeAttribute("aria-current");
      });
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
menuToggle.addEventListener("click", () => {
  const open=menuToggle.getAttribute("aria-expanded")!=="true";
  setMenu(open);
  if(open) mobileMenu.querySelector("a").focus();
});
mobileMenu.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
  setMenu(false);
  if(link.hash) document.querySelector(link.hash)?.focus({preventScroll:true});
}));
header.addEventListener("focusout", () => {
  window.requestAnimationFrame(() => {
    if(!mobileMenu.hidden&&!header.contains(document.activeElement)) setMenu(false);
  });
});
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

const interfaceViewer=document.getElementById("interface-viewer");
const interfaceImage=document.getElementById("interface-image");
let interfaceTrigger=null;
document.querySelectorAll("a[data-interface]").forEach(link=>{
  link.addEventListener("click",event=>{
    if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||typeof interfaceViewer.showModal!=="function") return;
    event.preventDefault();
    interfaceTrigger=link;
    document.getElementById("interface-title").textContent=link.dataset.interface;
    interfaceImage.alt=link.dataset.interface;
    interfaceImage.src=link.href;
    interfaceViewer.showModal();
    document.body.classList.add("viewer-open");
  });
});
interfaceViewer.querySelector("button").addEventListener("click",()=>interfaceViewer.close());
interfaceViewer.addEventListener("close",()=>{
  document.body.classList.remove("viewer-open");
  interfaceTrigger?.focus({preventScroll:true});
});
interfaceViewer.addEventListener("click",event=>{
  if(event.target===interfaceViewer) {
    const bounds=interfaceViewer.getBoundingClientRect();
    if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom) interfaceViewer.close();
  }
});
