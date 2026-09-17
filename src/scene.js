import { PLAYERS, FINISH, tokenCell, legalMoves } from './rules.js';
import { THEMES, boardTexture, surfaceTexture, diceTexture, numberTexture } from './textures.js';
import { boardVertexShader, boardFragmentShader } from './shaders/board.js';
import { CameraRig } from './camera.js';
const THREE=globalThis.THREE;
// r140 defaults to legacy color handling. Enable linear-light color management.
if(THREE?.ColorManagement)THREE.ColorManagement.legacyMode=false;
const CELL=.64, BOARD_Y=.218;
const ease=t=>t*t*(3-2*t);
const cellToWorld=([c,r],y=BOARD_Y)=>new THREE.Vector3((c-7)*CELL,y,(r-7)*CELL);

/** BoxGeometry retains six material groups and UV sets. The bevel is our own
 * geometric projection of each vertex onto a rounded cube (no model download).
 */
function roundedBox(size,radius=.09,segments=8){
  const geo=new THREE.BoxGeometry(size,size,size,segments,segments,segments);
  const p=geo.attributes.position,n=geo.attributes.normal,core=size/2-radius;
  const v=new THREE.Vector3(),closest=new THREE.Vector3(),normal=new THREE.Vector3();
  for(let i=0;i<p.count;i++){
    v.fromBufferAttribute(p,i);closest.set(THREE.MathUtils.clamp(v.x,-core,core),THREE.MathUtils.clamp(v.y,-core,core),THREE.MathUtils.clamp(v.z,-core,core));
    normal.copy(v).sub(closest).normalize();v.copy(closest).addScaledVector(normal,radius);
    p.setXYZ(i,v.x,v.y,v.z);n.setXYZ(i,normal.x,normal.y,normal.z);
  }
  geo.computeBoundingSphere();return geo;
}
export class LudoScene {
  constructor(host,{onPick,onStats,onFatal}){
    if(!THREE)throw new Error('Three.js did not load. Check your internet connection and the pinned CDN script in index.html.');
    this.host=host;this.onPick=onPick;this.onStats=onStats;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#ececf4');
    this.scene.fog=new THREE.Fog('#ececf4',32,85);
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
    this.renderer.outputEncoding=THREE.sRGBEncoding;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.0;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute('aria-label','Interactive 3D Ludo board. Drag to orbit, click the board to change texture, or choose a token.');
    this.renderer.domElement.tabIndex=0;host.prepend(this.renderer.domElement);
    this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();onFatal('The graphics context was lost. Reload the page to restore the scene. Your normal game is saved.');});
    this.camera=new THREE.PerspectiveCamera(40,1,.1,120); // Required perspective projection, including top view.
    this.rig=new CameraRig(this.camera,this.renderer.domElement,e=>this.pick(e));
    this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();
    this.time=performance.now()/1000;this.lastTime=this.time;this.frames=0;this.statsTime=this.time;
    this.theme=0;this.themeTransition=null;this.orbitLight=false;this.lightPower=1;this.jobs=[];
    this.textures={ceramic:surfaceTexture(),wood:surfaceTexture('wood'),felt:surfaceTexture('felt')};
    this.boardMaps=THEMES.map((_,i)=>boardTexture(i));
    this.makeLights();this.makeBoard();this.makeTokens();this.makeDie();
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);this.resize();
    this.animate=this.animate.bind(this);this.renderer.setAnimationLoop(this.animate);
  }
  material(color,map=this.textures.ceramic,extra={}){
    return new THREE.MeshStandardMaterial({color,map,roughness:.43,metalness:.03,...extra});
  }
  mesh(geometry,material,position,parent=this.scene){
    const object=new THREE.Mesh(geometry,material);object.position.copy(position);object.castShadow=true;object.receiveShadow=true;parent.add(object);return object;
  }
  makeLights(){
    this.scene.add(new THREE.HemisphereLight(0xffffff,0x8994b3,.74));
    this.scene.add(new THREE.AmbientLight(0xffffff,.15));
    this.keyLight=new THREE.DirectionalLight(0xfff6e6,1.55);this.keyLight.position.set(-3,12,7);this.keyLight.castShadow=true;
    const sc=this.keyLight.shadow.camera;Object.assign(sc,{left:-10,right:10,top:10,bottom:-10,near:.5,far:40});
    this.keyLight.shadow.mapSize.set(1024,1024);this.keyLight.shadow.normalBias=.018;this.keyLight.shadow.bias=-.0002;this.keyLight.shadow.radius=3;
    this.scene.add(this.keyLight);this.scene.add(this.keyLight.target);
    this.fillLight=new THREE.DirectionalLight(0xd4dfff,.48);this.fillLight.position.set(5,5,-6);this.scene.add(this.fillLight);
  }
  makeBoard(){
    const floor=this.mesh(new THREE.PlaneGeometry(200,200),this.material('#e4e5ed',this.textures.felt,{roughness:.97}),new THREE.Vector3(0,-.47,0));floor.rotation.x=-Math.PI/2;floor.castShadow=false;
    this.frameMaterial=this.material('#f1e7d2',this.textures.wood,{roughness:.38});
    this.mesh(new THREE.BoxGeometry(10.03,.40,10.03),this.frameMaterial,new THREE.Vector3(0,0,0));
    this.mesh(new THREE.BoxGeometry(10.10,.08,10.10),this.material('#b9a584',this.textures.wood),new THREE.Vector3(0,-.18,0));
    for(const x of [-4.35,4.35])for(const z of [-4.35,4.35])this.mesh(new THREE.CylinderGeometry(.26,.26,.23,20),this.material('#726d70'),new THREE.Vector3(x,-.34,z));
    this.boardMaterial=new THREE.ShaderMaterial({
      name:'Authored textured and lit Ludo board',lights:true,
      uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.lights,{
        uPreviousMap:{value:this.boardMaps[0]},uMap:{value:this.boardMaps[0]},uMix:{value:1},uTime:{value:0},
        uLightPower:{value:1},uActivePlayer:{value:0},uLightDirection:{value:new THREE.Vector3(0,1,0)}
      }]),
      vertexShader:boardVertexShader,fragmentShader:boardFragmentShader
    });
    // UniformsUtils clones texture uniforms. Use our actual cached textures, without duplicate GPU maps.
    this.boardMaterial.uniforms.uPreviousMap.value=this.boardMaps[0];this.boardMaterial.uniforms.uMap.value=this.boardMaps[0];
    this.board=this.mesh(new THREE.PlaneGeometry(9.60,9.60),this.boardMaterial,new THREE.Vector3(0,BOARD_Y-.008,0));
    this.board.rotation.x=-Math.PI/2;this.board.castShadow=false;this.board.userData.action='board';
  }
  makeTokens(){
    this.pawns=[];this.pickTargets=[this.board];
    const profile=[[0,0],[.18,0],[.207,.035],[.202,.085],[.14,.12],[.11,.20],[.097,.35],[.13,.41],[.12,.46],[0,.46]].map(([x,y])=>new THREE.Vector2(x,y));
    const body=new THREE.LatheGeometry(profile,28),head=new THREE.SphereGeometry(.157,24,16),trim=new THREE.TorusGeometry(.181,.012,8,28);
    const markerGeo=new THREE.TorusGeometry(.28,.016,8,40),numberMaps=[1,2,3,4].map(numberTexture);
    PLAYERS.forEach((player,p)=>{
      const material=this.material(player.hex,this.textures.ceramic,{roughness:.25,metalness:.12});
      for(let i=0;i<4;i++){
        const group=new THREE.Group();group.userData={action:'token',player:p,token:i};this.scene.add(group);
        this.mesh(body,material,new THREE.Vector3(),group);
        this.mesh(head,material,new THREE.Vector3(0,.53,0),group);
        const band=this.mesh(trim,this.material('#f4d59a',this.textures.ceramic,{metalness:.45,roughness:.29}),new THREE.Vector3(0,.076,0),group);band.rotation.x=Math.PI/2;
        const halo=this.mesh(markerGeo,this.material(player.hex,this.textures.ceramic,{emissive:player.hex,emissiveIntensity:.4}),new THREE.Vector3(0,.012,0),group);halo.rotation.x=Math.PI/2;halo.castShadow=false;halo.visible=false;
        const label=new THREE.Sprite(new THREE.SpriteMaterial({map:numberMaps[i],depthTest:true,depthWrite:false}));label.position.set(0,.78,0);label.scale.set(.23,.23,.23);group.add(label);
        this.pawns.push({group,halo,player:p,token:i,label});this.pickTargets.push(group);
      }
    });
  }
  makeDie(){
    this.dieOrigin=new THREE.Vector3(6.05,.39,1.3);
    this.mesh(new THREE.CylinderGeometry(1.1,1.13,.20,64),this.material('#dddde9',this.textures.felt),new THREE.Vector3(6.05,-.31,1.3));
    this.mesh(new THREE.CylinderGeometry(1.04,1.04,.06,64),this.material('#f6f4f2',this.textures.felt),new THREE.Vector3(6.05,-.18,1.3));
    const mats=[3,4,1,6,2,5].map(n=>this.material('#ffffff',diceTexture(n),{roughness:.28,metalness:0}));
    this.die=this.mesh(roundedBox(1.06,.095),mats,this.dieOrigin);this.die.userData.action='dice';this.pickTargets.push(this.die);
    this.die.quaternion.copy(this.faceQuaternion(1));this.diceValue=1;this.previewSpin=true;
  }
  faceQuaternion(value){
    const normals={1:[0,1,0],2:[0,0,1],3:[1,0,0],4:[-1,0,0],5:[0,0,-1],6:[0,-1,0]};
    const align=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(...normals[value]),new THREE.Vector3(0,1,0));
    return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),.35).multiply(align);
  }
  setState(state){
    this.state=state;const choices=legalMoves(state),occupied=new Map();
    for(const pawn of this.pawns){
      const {player,token,group,halo}=pawn;const progress=state.tokens[player][token];group.visible=state.active.includes(player);
      const cell=tokenCell(player,token,progress);group.position.copy(cellToWorld(cell));group.scale.setScalar(progress===FINISH?.64:1);
      halo.visible=state.turn===player&&choices.includes(token);pawn.legal=halo.visible;
      if(progress>=0&&progress<FINISH&&group.visible){const key=cell.join(',');if(!occupied.has(key))occupied.set(key,[]);occupied.get(key).push(pawn);}
    }
    // Shared squares do not visually hide tokens: deterministic offsets and scale.
    for(const list of occupied.values())if(list.length>1)list.forEach((p,i)=>{
      const angle=2*Math.PI*i/list.length;p.group.position.x+=Math.cos(angle)*.13;p.group.position.z+=Math.sin(angle)*.13;p.group.scale.multiplyScalar(list.length>2?.63:.74);
    });
    this.boardMaterial.uniforms.uActivePlayer.value=state.turn;
    if(!this.dieJob&&state.rollCount>0){this.previewSpin=false;this.diceValue=state.dice||1;this.die.quaternion.copy(this.faceQuaternion(this.diceValue));}
  }
  setTheme(index){
    if(!Number.isInteger(index)||index<0||index>=THEMES.length)return;
    if(index===this.theme)return;
    const u=this.boardMaterial.uniforms;
    u.uPreviousMap.value=this.boardMaps[this.theme];u.uMap.value=this.boardMaps[index];u.uMix.value=0;
    this.theme=index;this.themeTransition=this.time;this.frameMaterial.color.set(THEMES[index].frame);
  }
  setLight(value){this.lightPower=THREE.MathUtils.clamp(value,.25,1.8);this.keyLight.intensity=1.55*this.lightPower;this.boardMaterial.uniforms.uLightPower.value=this.lightPower;}
  animateDie(value){
    this.previewSpin=false;
    return new Promise(resolve=>{this.dieJob={start:this.time,value,initial:this.die.quaternion.clone(),target:this.faceQuaternion(value),resolve};});
  }
  animateMove(move){
    const pawn=this.pawns[move.player*4+move.token];const path=[pawn.group.position.clone()];
    if(move.before===-1)path.push(cellToWorld(tokenCell(move.player,move.token,0)));
    else for(let step=move.before+1;step<=move.after;step++)path.push(cellToWorld(tokenCell(move.player,move.token,step)));
    pawn.halo.visible=false;
    const captures=move.captured.map(c=>({pawn:this.pawns[c.player*4+c.token],from:this.pawns[c.player*4+c.token].group.position.clone(),to:cellToWorld(tokenCell(c.player,c.token,-1))}));
    return new Promise(resolve=>this.jobs.push({start:this.time,duration:move.before===-1?.58:(path.length-1)*.15,pawn,path,captures,resolve}));
  }
  pick(event){
    const rect=this.renderer.domElement.getBoundingClientRect();this.pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    this.raycaster.setFromCamera(this.pointer,this.camera);
    const hits=this.raycaster.intersectObjects(this.pickTargets,true);
    for(const hit of hits){
      let item=hit.object;while(item&&!item.userData.action)item=item.parent;
      if(!item||!item.visible)continue;
      if(item.userData.action==='token'&&!this.state.active.includes(item.userData.player))continue;
      this.onPick(item.userData);return;
    }
  }
  resize(){const width=this.host.clientWidth,height=this.host.clientHeight;if(!width||!height)return;this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(40)/2)*Math.max(1,1.25/this.camera.aspect)));this.camera.updateProjectionMatrix();}
  animate(timestamp){
    this.time=timestamp/1000;const dt=Math.min(.06,Math.max(0,this.time-this.lastTime));this.lastTime=this.time;
    this.rig.update(dt);
    if(this.orbitLight)this.keyLight.position.set(Math.cos(this.time*.35)*9,12,Math.sin(this.time*.35)*9);
    const direction=this.keyLight.position.clone().sub(this.keyLight.target.position).normalize().transformDirection(this.camera.matrixWorldInverse);
    this.boardMaterial.uniforms.uLightDirection.value.copy(direction);this.boardMaterial.uniforms.uTime.value=this.time;
    if(this.themeTransition!==null){this.boardMaterial.uniforms.uMix.value=Math.min(1,(this.time-this.themeTransition)/.65);if(this.boardMaterial.uniforms.uMix.value===1)this.themeTransition=null;}
    for(const p of this.pawns)if(p.legal)p.halo.scale.setScalar(1+.08*Math.sin(this.time*4));
    if(this.dieJob){
      const job=this.dieJob,t=Math.min(1,(this.time-job.start)/1.15);
      if(t<.72){const q=t/.72;this.die.quaternion.copy(job.initial).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(q*Math.PI*6,q*Math.PI*8,q*Math.PI*4)));}
      else this.die.quaternion.slerpQuaternions(job.initial,job.target,ease((t-.72)/.28));
      this.die.position.copy(this.dieOrigin);this.die.position.y+=Math.sin(Math.PI*t)*1.55;this.die.position.x+=Math.sin(t*Math.PI*2)*.16;
      if(t===1){this.die.quaternion.copy(job.target);this.die.position.copy(this.dieOrigin);this.diceValue=job.value;this.dieJob=null;job.resolve();}
    }else if(this.previewSpin){this.die.rotation.x+=dt*.46;this.die.rotation.y+=dt*.73;this.die.position.y=this.dieOrigin.y+.12+.06*Math.sin(this.time*1.8);}
    for(const job of [...this.jobs]){
      const elapsed=this.time-job.start,t=Math.min(1,elapsed/job.duration),segments=job.path.length-1,step=Math.min(segments-1,Math.floor(t*segments)),phase=t===1?1:t*segments-step;
      job.pawn.group.position.lerpVectors(job.path[step],job.path[step+1],ease(phase));job.pawn.group.position.y+=Math.sin(Math.PI*phase)*.3;
      if(t===1&&job.captures.length){const c=Math.min(1,(elapsed-job.duration)/.45);for(const capture of job.captures){capture.pawn.group.position.lerpVectors(capture.from,capture.to,ease(c));capture.pawn.group.position.y+=Math.sin(Math.PI*c)*.65;}}
      if(elapsed>=job.duration+(job.captures.length?.45:0)){this.jobs.splice(this.jobs.indexOf(job),1);job.resolve();}
    }
    this.renderer.render(this.scene,this.camera);this.frames++;
    if(this.time-this.statsTime>=1){this.onStats?.({fps:Math.round(this.frames/(this.time-this.statsTime)),triangles:this.renderer.info.render.triangles});this.frames=0;this.statsTime=this.time;}
  }
  diagnostics(){
    const missing=[];let meshes=0;
    this.scene.traverse(o=>{if(!o.isMesh&&!o.isSprite)return;meshes++;for(const m of Array.isArray(o.material)?o.material:[o.material])if(!m.map&&!m.uniforms?.uMap?.value)missing.push(o.name||o.type);});
    return {threeRevision:THREE.REVISION,theme:this.theme,camera:this.camera.position.toArray(),cameraFov:this.camera.fov,lightPower:this.lightPower,orbitLight:this.orbitLight,perspective:this.camera.isPerspectiveCamera,meshes,untexturedMeshes:missing,shader:this.boardMaterial.type,diceValue:this.diceValue,dieQuaternion:this.die.quaternion.toArray(),animations:this.jobs.length+(this.dieJob?1:0)};
  }
}
