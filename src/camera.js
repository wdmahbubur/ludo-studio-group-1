/** A small original orbit controller: keyboard and mouse update spherical coordinates.
 * Unlike a camera-position shortcut, these controls genuinely orbit the board target.
 */
const THREE=globalThis.THREE;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export class CameraRig {
  constructor(camera,canvas,onClick){
    this.camera=camera;this.canvas=canvas;this.target=new THREE.Vector3(.6,.2,0);
    this.home={theta:.35,phi:.62,radius:20};this.current={...this.home};this.goal={...this.home};
    this.keys=new Set();this.autoOrbit=false;this.pointer=null;this.top=false;
    canvas.addEventListener('pointerdown',e=>{
      if(e.button!==0)return;canvas.focus({preventScroll:true});this.pointer={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,distance:0};canvas.setPointerCapture(e.pointerId);canvas.classList.add('dragging');
    });
    canvas.addEventListener('pointermove',e=>{
      const p=this.pointer;if(!p||p.id!==e.pointerId)return;
      const dx=e.clientX-p.x,dy=e.clientY-p.y;p.distance+=Math.abs(dx)+Math.abs(dy);p.x=e.clientX;p.y=e.clientY;
      if(p.distance>5){this.goal.theta-=dx*.006;this.goal.phi=clamp(this.goal.phi-dy*.006,.10,1.28);this.top=false;}
    });
    canvas.addEventListener('pointerup',e=>{
      if(this.pointer?.id!==e.pointerId)return;const click=this.pointer.distance<=5;this.pointer=null;canvas.classList.remove('dragging');
      if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(click)onClick(e);
    });
    const cancel=()=>{this.pointer=null;canvas.classList.remove('dragging');};
    canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('lostpointercapture',cancel);
    canvas.addEventListener('wheel',e=>{e.preventDefault();this.goal.radius=clamp(this.goal.radius+e.deltaY*.01,12,32);},{passive:false});
    window.addEventListener('keydown',e=>{
      if(e.target.closest('input,select,textarea,button,dialog')||e.ctrlKey||e.metaKey||e.altKey)return;
      if(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)){e.preventDefault();this.keys.add(e.code);}
    });
    window.addEventListener('keyup',e=>this.keys.delete(e.code));window.addEventListener('blur',()=>this.keys.clear());
    document.addEventListener('visibilitychange',()=>this.keys.clear());
    this.update(1);
  }
  reset(){this.goal={...this.home};this.autoOrbit=false;this.top=false;}
  topView(){this.goal={theta:0,phi:.10,radius:19};this.top=true;this.autoOrbit=false;}
  update(dt){
    const k=this.keys,has=(...codes)=>codes.some(c=>k.has(c));
    if(has('KeyA','ArrowLeft'))this.goal.theta-=dt*1.2;
    if(has('KeyD','ArrowRight'))this.goal.theta+=dt*1.2;
    if(has('KeyW','ArrowUp'))this.goal.phi-=dt*.8;
    if(has('KeyS','ArrowDown'))this.goal.phi+=dt*.8;
    if(has('KeyQ'))this.goal.radius-=dt*8;
    if(has('KeyE'))this.goal.radius+=dt*8;
    if(this.autoOrbit)this.goal.theta+=dt*.18;
    this.goal.phi=clamp(this.goal.phi,.10,1.28);this.goal.radius=clamp(this.goal.radius,12,32);
    const a=1-Math.exp(-12*dt);for(const key of ['theta','phi','radius'])this.current[key]+=(this.goal[key]-this.current[key])*a;
    const {theta,phi,radius}=this.current;
    this.camera.position.set(this.target.x+radius*Math.sin(phi)*Math.sin(theta),this.target.y+radius*Math.cos(phi),this.target.z+radius*Math.sin(phi)*Math.cos(theta));
    this.camera.lookAt(this.target);this.camera.updateMatrixWorld();
  }
}
