EphemeraApps.register({
    id: 'appmanager',
    name: 'App Manager',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
    width: 780,
    height: 570,
    category: 'system',
    singleton: true,
    content: (windowId) => {
        const REGISTRY_URL = 'https://raw.githubusercontent.com/ephemera-os/app-registry/main/apps.json';
        const REGISTRY_FALLBACK_URL = 'https://cdn.jsdelivr.net/gh/ephemera-os/app-registry@main/apps.json';
        const REGISTRY_REPO = 'https://github.com/ephemera-os/app-registry';
        const REGISTRY_DISCUSSIONS = `${REGISTRY_REPO}/discussions`;

        // â”€â”€â”€ App Templates â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        const TEMPLATES = [
            {
                id: 'dashboard',
                name: 'Dashboard',
                color: '#00d4aa',
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/><polyline points="6 10 10 7 14 12 18 8"/></svg>',
                description: 'Stats cards, bar chart, and auto-refresh. Ideal for monitoring dashboards.',
                code: `container.style.cssText='height:100%;overflow:auto;';
var rnd=function(a,b){return Math.floor(Math.random()*(b-a+1))+a;};
var STATS=[{l:'Active Users',v:function(){return rnd(1100,1900).toLocaleString();},c:'#00d4aa'},
  {l:'Revenue',v:function(){return '$'+rnd(40,90)+'k';},c:'#a78bfa'},
  {l:'Uptime',v:function(){return rnd(97,100).toFixed(1)+'%';},c:'#34d399'},
  {l:'Open Tickets',v:function(){return rnd(0,12);},c:'#f87171'}];
var DAYS=['M','T','W','T','F','S','S'];
container.innerHTML='<style>.d{padding:14px}.hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}.ttl{font-size:1.1rem;font-weight:600}.tm{font-size:.75rem;color:#9898a8}.g{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}.c{background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:14px}.cl{font-size:.7rem;color:#9898a8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px}.cv{font-size:1.6rem;font-weight:700}.ch{background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:14px;margin-bottom:10px}.cht{font-size:.8rem;color:#9898a8;margin-bottom:8px}.bs{display:flex;align-items:flex-end;gap:5px;height:70px}.b{flex:1;border-radius:3px 3px 0 0;min-height:4px}.bl{flex:1;text-align:center;font-size:.6rem;color:#58586a;margin-top:4px}.rf{width:100%;padding:8px;background:#00d4aa;color:#0a0a0f;border:none;border-radius:6px;cursor:pointer;font-size:.85rem;font-weight:600}</style><div class="d"><div class="hdr"><div class="ttl">Dashboard</div><div class="tm" id="tm"></div></div><div class="g" id="cds"></div><div class="ch"><div class="cht">Weekly Activity</div><div class="bs" id="brs"></div><div class="bs" style="height:auto;padding-top:4px" id="lbs"></div></div><button class="rf" id="rf">Refresh</button></div>';
function refresh(){
  document.getElementById('tm').textContent=new Date().toLocaleTimeString();
  document.getElementById('cds').innerHTML=STATS.map(function(s){return '<div class="c"><div class="cl">'+s.l+'</div><div class="cv" style="color:'+s.c+'">'+s.v()+'</div></div>';}).join('');
  var vs=DAYS.map(function(){return rnd(20,100);});
  var mx=Math.max.apply(null,vs);
  document.getElementById('brs').innerHTML=vs.map(function(v,i){return '<div class="b" style="height:'+Math.max(4,Math.round(v/mx*70))+'px;background:'+(i===new Date().getDay()-1?'#a78bfa':'#00d4aa')+';opacity:.75"></div>';}).join('');
  document.getElementById('lbs').innerHTML=DAYS.map(function(d){return '<div class="bl">'+d+'</div>';}).join('');
}
refresh();document.getElementById('rf').onclick=refresh;`
            },
            {
                id: 'form',
                name: 'Form App',
                color: '#a78bfa',
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
                description: 'Input form with field validation and confirmation display.',
                code: `container.style.cssText='height:100%;overflow:auto;';
container.innerHTML='<style>.af{padding:16px;max-width:480px;margin:0 auto}.af-title{font-size:1.1rem;font-weight:600;margin-bottom:16px}.af-row{margin-bottom:14px}.af-label{display:block;font-size:.82rem;color:#9898a8;margin-bottom:6px}.af-input{width:100%;padding:8px 12px;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.12);border-radius:6px;color:#e8e8f0;font-size:.9rem;outline:none;font-family:inherit;box-sizing:border-box}.af-input:focus{border-color:#00d4aa}.af-err{font-size:.75rem;color:#f87171;margin-top:4px;display:none}.af-btn{width:100%;padding:10px;background:#00d4aa;color:#0a0a0f;border:none;border-radius:6px;cursor:pointer;font-size:.9rem;font-weight:600;margin-top:4px}.af-btn:hover{background:#00f0c0}.af-result{margin-top:16px;padding:14px;background:rgba(0,212,170,.1);border:1px solid rgba(0,212,170,.3);border-radius:8px;display:none}</style><div class="af"><div class="af-title">Contact Form</div><div class="af-row"><label class="af-label">Full Name *</label><input class="af-input" id="af-name" placeholder="Jane Doe"><div class="af-err" id="af-name-err">Name is required</div></div><div class="af-row"><label class="af-label">Email *</label><input class="af-input" id="af-email" placeholder="jane@example.com"><div class="af-err" id="af-email-err">Valid email required</div></div><div class="af-row"><label class="af-label">Category</label><select class="af-input" id="af-cat"><option>General Inquiry</option><option>Bug Report</option><option>Feature Request</option><option>Other</option></select></div><div class="af-row"><label class="af-label">Message</label><textarea class="af-input" id="af-msg" rows="4" placeholder="Your message here..."></textarea></div><button class="af-btn" id="af-submit">Send Message</button><div class="af-result" id="af-result"></div></div>';
document.getElementById('af-submit').onclick=function(){
  var name=document.getElementById('af-name').value.trim();
  var email=document.getElementById('af-email').value.trim();
  var cat=document.getElementById('af-cat').value;
  var msg=document.getElementById('af-msg').value.trim();
  var valid=true;
  document.getElementById('af-name-err').style.display='none';
  document.getElementById('af-email-err').style.display='none';
  if(!name){document.getElementById('af-name-err').style.display='block';valid=false;}
  if(!email||!/^[^@]+@[^@]+\.[^@]+$/.test(email)){document.getElementById('af-email-err').style.display='block';valid=false;}
  if(valid){
    var res=document.getElementById('af-result');
    res.style.display='block';
    res.innerHTML='<strong style="color:#00d4aa">Submitted!</strong><br><br>'+'<small style="color:#9898a8">Name: </small>'+name+'<br><small style="color:#9898a8">Email: </small>'+email+'<br><small style="color:#9898a8">Category: </small>'+cat+(msg?'<br><small style="color:#9898a8">Message: </small>'+msg:'');
    document.getElementById('af-name').value='';
    document.getElementById('af-email').value='';
    document.getElementById('af-msg').value='';
  }};`
            },
            {
                id: 'datatable',
                name: 'Data Table',
                color: '#34d399',
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="9" x2="9" y2="21"/></svg>',
                description: 'Sortable, searchable table with sample data. Ideal for list and CRUD UIs.',
                code: `container.style.cssText='height:100%;overflow:auto;';
var DATA=[{name:'Alice Chen',dept:'Engineering',status:'Active',score:94},{name:'Bob Martin',dept:'Design',status:'Active',score:87},{name:'Carol White',dept:'Marketing',status:'On Leave',score:72},{name:'David Kim',dept:'Engineering',status:'Active',score:91},{name:'Eve Torres',dept:'Sales',status:'Active',score:83},{name:'Frank Liu',dept:'Design',status:'Inactive',score:65},{name:'Grace Park',dept:'Engineering',status:'Active',score:96},{name:'Henry Adams',dept:'Marketing',status:'Active',score:78}];
var sortCol='',sortDir=1,filterText='';
container.innerHTML='<style>.dt{padding:14px}.dt-title{font-size:1.1rem;font-weight:600;margin-bottom:12px}.dt-search{width:100%;padding:8px 12px;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.12);border-radius:6px;color:#e8e8f0;font-size:.85rem;outline:none;font-family:inherit;margin-bottom:12px;box-sizing:border-box}.dt-search:focus{border-color:#00d4aa}.dt-table{width:100%;border-collapse:collapse}.dt-th{padding:8px 12px;text-align:left;font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:#9898a8;border-bottom:1px solid rgba(255,255,255,.08);cursor:pointer;user-select:none}.dt-th:hover{color:#e8e8f0}.sa::after{content:" \u2191"}.sd::after{content:" \u2193"}.dt-td{padding:8px 12px;font-size:.85rem;border-bottom:1px solid rgba(255,255,255,.05)}.sa{color:#00d4aa}.sl{color:#fbbf24}.si{color:#f87171}.shi{color:#00d4aa}.smi{color:#fbbf24}.slo{color:#f87171}.dt-count{font-size:.75rem;color:#9898a8;margin-top:8px}</style><div class="dt"><div class="dt-title">Data Table</div><input class="dt-search" id="dt-s" placeholder="Search name, department, status..."><table class="dt-table"><thead><tr><th class="dt-th" data-col="name">Name</th><th class="dt-th" data-col="dept">Department</th><th class="dt-th" data-col="status">Status</th><th class="dt-th" data-col="score">Score</th></tr></thead><tbody id="dt-body"></tbody></table><div class="dt-count" id="dt-count"></div></div>';
function renderTable(){
  var q=filterText.toLowerCase();
  var rows=DATA.filter(function(r){return !q||r.name.toLowerCase().includes(q)||r.dept.toLowerCase().includes(q)||r.status.toLowerCase().includes(q);});
  if(sortCol){rows.sort(function(a,b){var av=a[sortCol],bv=b[sortCol];return(typeof av==='number'?(av-bv):av.localeCompare(bv))*sortDir;});}
  document.getElementById('dt-body').innerHTML=rows.map(function(r){var sc=r.score>=90?'shi':r.score>=75?'smi':'slo';var st=r.status==='Active'?'sa':r.status==='On Leave'?'sl':'si';return '<tr><td class="dt-td">'+r.name+'</td><td class="dt-td">'+r.dept+'</td><td class="dt-td '+st+'">'+r.status+'</td><td class="dt-td '+sc+'">'+r.score+'</td></tr>';}).join('');
  document.getElementById('dt-count').textContent=rows.length+' of '+DATA.length+' records';
}
document.querySelectorAll('.dt-th').forEach(function(th){th.onclick=function(){var col=th.dataset.col;sortDir=sortCol===col?sortDir*-1:1;sortCol=col;document.querySelectorAll('.dt-th').forEach(function(h){h.classList.remove('sa','sd');});th.classList.add(sortDir===1?'sa':'sd');renderTable();};});
document.getElementById('dt-s').oninput=function(){filterText=this.value;renderTable();};
renderTable();`
            },
            {
                id: 'game',
                name: 'Canvas Game',
                color: '#f87171',
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h4m-2-2v4"/><circle cx="15" cy="11" r="1" fill="currentColor"/><circle cx="18" cy="13" r="1" fill="currentColor"/></svg>',
                description: 'Paddle ball canvas game. Demonstrates canvas rendering and game loop.',
                code: `container.style.cssText='height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;user-select:none;';
container.innerHTML='<style>.cg-title{font-size:1rem;font-weight:600;margin-bottom:10px;color:#e8e8f0}.cg-canvas{border:2px solid rgba(0,212,170,.3);border-radius:8px;background:#0d0d18;display:block}.cg-btns{margin-top:10px;display:flex;gap:8px}.cg-btn{padding:7px 16px;border:none;border-radius:6px;cursor:pointer;font-size:.82rem;font-weight:600;font-family:inherit}.primary{background:#00d4aa;color:#0a0a0f}.secondary{background:transparent;border:1px solid rgba(255,255,255,.2);color:#e8e8f0}.cg-score{margin-top:8px;font-size:.85rem;color:#9898a8;min-height:1.2em}</style><div class="cg-title">Paddle Ball</div><canvas class="cg-canvas" id="cvs" width="400" height="220"></canvas><div class="cg-btns"><button class="cg-btn primary" id="cg-start">Start</button><button class="cg-btn secondary" id="cg-reset">Reset</button></div><div class="cg-score" id="cg-score">Press Start to play â€” move mouse to control paddle</div>';
var cvs=document.getElementById('cvs'),ctx=cvs.getContext('2d');
var W=cvs.width,H=cvs.height,running=false,score=0,lives=3;
var ball={x:W/2,y:H/2,vx:3.5,vy:-2.5,r:8};
var pad={x:W/2-45,y:H-18,w:90,h:10};
var raf=null;
function draw(){ctx.clearRect(0,0,W,H);ctx.fillStyle='rgba(0,212,170,.9)';ctx.beginPath();ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(167,139,250,.9)';ctx.beginPath();if(ctx.roundRect)ctx.roundRect(pad.x,pad.y,pad.w,pad.h,4);else ctx.rect(pad.x,pad.y,pad.w,pad.h);ctx.fill();}
function step(){ball.x+=ball.vx;ball.y+=ball.vy;if(ball.x-ball.r<0){ball.x=ball.r;ball.vx=Math.abs(ball.vx);}if(ball.x+ball.r>W){ball.x=W-ball.r;ball.vx=-Math.abs(ball.vx);}if(ball.y-ball.r<0){ball.y=ball.r;ball.vy=Math.abs(ball.vy);}if(ball.y+ball.r>pad.y&&ball.y-ball.r<pad.y+pad.h&&ball.x>pad.x&&ball.x<pad.x+pad.w){ball.vy=-Math.abs(ball.vy);ball.vx+=(ball.x-(pad.x+pad.w/2))/22;score++;if(score%5===0){ball.vx*=1.06;ball.vy*=1.06;}document.getElementById('cg-score').textContent='Score: '+score+'   Lives: '+lives;}if(ball.y>H+ball.r){lives--;if(lives<=0){running=false;document.getElementById('cg-score').textContent='Game Over! Score: '+score;document.getElementById('cg-start').textContent='Restart';return;}ball.x=W/2;ball.y=H/2;ball.vx=3.5*(Math.random()>.5?1:-1);ball.vy=-2.5;document.getElementById('cg-score').textContent='Score: '+score+'   Lives: '+lives;}draw();if(running)raf=requestAnimationFrame(step);}
cvs.addEventListener('mousemove',function(e){var r=cvs.getBoundingClientRect();pad.x=Math.min(W-pad.w,Math.max(0,e.clientX-r.left-pad.w/2));});
document.getElementById('cg-start').onclick=function(){if(!running){running=true;this.textContent='Pause';step();}else{running=false;cancelAnimationFrame(raf);this.textContent='Resume';}};
document.getElementById('cg-reset').onclick=function(){running=false;cancelAnimationFrame(raf);score=0;lives=3;ball={x:W/2,y:H/2,vx:3.5,vy:-2.5,r:8};pad.x=W/2-45;document.getElementById('cg-start').textContent='Start';document.getElementById('cg-score').textContent='Press Start to play â€” move mouse to control paddle';draw();};
draw();`
            },
            {
                id: 'apiclient',
                name: 'API Client',
                color: '#fbbf24',
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>',
                description: 'HTTP client with method selector, request body editor, and response viewer.',
                code: `container.style.cssText='height:100%;overflow:auto;';
container.innerHTML='<style>.ac{padding:14px;height:100%;box-sizing:border-box;display:flex;flex-direction:column}.ac-title{font-size:1.1rem;font-weight:600;margin-bottom:14px}.ac-row{display:flex;gap:8px;margin-bottom:10px}.ac-sel{padding:8px 10px;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.12);border-radius:6px;color:#e8e8f0;font-size:.85rem;cursor:pointer;font-family:inherit;outline:none}.ac-sel:focus{border-color:#00d4aa}.ac-url{flex:1;padding:8px 12px;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.12);border-radius:6px;color:#e8e8f0;font-size:.85rem;outline:none;font-family:inherit}.ac-url:focus{border-color:#00d4aa}.ac-lbl{font-size:.8rem;color:#9898a8;margin-bottom:6px}.ac-body{width:100%;padding:8px 12px;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.12);border-radius:6px;color:#e8e8f0;font-size:.82rem;outline:none;font-family:monospace;resize:vertical;min-height:60px;box-sizing:border-box}.ac-body:focus{border-color:#00d4aa}.ac-send{padding:8px 20px;background:#00d4aa;color:#0a0a0f;border:none;border-radius:6px;cursor:pointer;font-size:.85rem;font-weight:600;margin:10px 0;font-family:inherit}.ac-send:hover{background:#00f0c0}.ac-send:disabled{opacity:.5;cursor:default}.ac-resp-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}.ac-badge{font-size:.78rem;padding:3px 8px;border-radius:4px;font-weight:600;display:none}.ok{background:rgba(52,211,153,.2);color:#34d399}.err{background:rgba(248,113,113,.2);color:#f87171}.ac-resp{flex:1;min-height:100px;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.08);border-radius:6px;padding:10px;font-family:monospace;font-size:.78rem;white-space:pre-wrap;overflow:auto;color:#9898a8}</style><div class="ac"><div class="ac-title">API Client</div><div class="ac-row"><select class="ac-sel" id="ac-m"><option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option></select><input class="ac-url" id="ac-url" placeholder="https://jsonplaceholder.typicode.com/todos/1"></div><div id="ac-bwrap" style="margin-bottom:8px;display:none"><div class="ac-lbl">Request Body (JSON)</div><textarea class="ac-body" id="ac-b" placeholder=\'{"key":"value"}\'></textarea></div><button class="ac-send" id="ac-send">Send Request</button><div class="ac-resp-hdr"><span style="font-size:.8rem;color:#9898a8">Response</span><span class="ac-badge" id="ac-badge"></span></div><div class="ac-resp" id="ac-resp">No request yet. Enter a URL and click Send.</div></div>';
document.getElementById('ac-m').onchange=function(){document.getElementById('ac-bwrap').style.display=this.value==='POST'||this.value==='PUT'?'block':'none';};
document.getElementById('ac-send').onclick=async function(){var url=document.getElementById('ac-url').value.trim();if(!url)return;var btn=this;btn.disabled=true;btn.textContent='Sending...';document.getElementById('ac-resp').textContent='Fetching...';document.getElementById('ac-badge').style.display='none';var t=Date.now();try{var opts={method:document.getElementById('ac-m').value,headers:{'Content-Type':'application/json'}};var b=document.getElementById('ac-b').value.trim();if(b&&(opts.method==='POST'||opts.method==='PUT'))opts.body=b;var resp=await fetch(url,opts);var ms=Date.now()-t;var text=await resp.text();try{text=JSON.stringify(JSON.parse(text),null,2);}catch(e){}var badge=document.getElementById('ac-badge');badge.style.display='inline';badge.textContent=resp.status+' '+resp.statusText+' ('+ms+'ms)';badge.className='ac-badge '+(resp.ok?'ok':'err');document.getElementById('ac-resp').textContent=text;}catch(err){var badge2=document.getElementById('ac-badge');badge2.style.display='inline';badge2.textContent='Network Error';badge2.className='ac-badge err';document.getElementById('ac-resp').textContent=err.message;}btn.disabled=false;btn.textContent='Send Request';};`
            },
            {
                id: 'mediaplayer',
                name: 'Media Player',
                color: '#60a5fa',
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><polygon points="10 8 16 12 10 16 10 8"/></svg>',
                description: 'Playlist-based audio player with transport controls and generated demo tracks.',
                code: `container.style.cssText='height:100%;overflow:auto;';
function makeToneUrl(freq,dur){var sr=44100,smp=Math.floor(sr*dur),buf=new ArrayBuffer(44+smp*2),v=new DataView(buf),o=0;function ws(s){for(var i=0;i<s.length;i++)v.setUint8(o++,s.charCodeAt(i));}function w16(n){v.setUint16(o,n,true);o+=2;}function w32(n){v.setUint32(o,n,true);o+=4;}ws('RIFF');w32(36+smp*2);ws('WAVEfmt ');w32(16);w16(1);w16(1);w32(sr);w32(sr*2);w16(2);w16(16);ws('data');w32(smp*2);for(var i=0;i<smp;i++){var t=i/sr;var env=Math.min(1,i/(sr*.03))*Math.min(1,(smp-i)/(sr*.08));var val=Math.sin(2*Math.PI*freq*t)*0.35*env;v.setInt16(o,Math.max(-1,Math.min(1,val))*32767,true);o+=2;}return URL.createObjectURL(new Blob([buf],{type:'audio/wav'}));}
var TRACKS=[{title:'Calm Intro (C4)',artist:'Demo Synth',url:makeToneUrl(261.63,2.4)},{title:'Pulse Loop (E4)',artist:'Demo Synth',url:makeToneUrl(329.63,2.1)},{title:'Bright Outro (G4)',artist:'Demo Synth',url:makeToneUrl(392.0,2.6)}];
var idx=0;
container.innerHTML='<style>.mp{padding:16px;max-width:520px;margin:0 auto}.mp-title{font-size:1.08rem;font-weight:600;margin-bottom:4px}.mp-sub{font-size:.78rem;color:#9898a8;margin-bottom:14px}.mp-card{background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:14px}.mp-now{font-size:.88rem;font-weight:600;margin-bottom:2px}.mp-artist{font-size:.75rem;color:#9898a8;margin-bottom:10px}.mp-controls{display:flex;align-items:center;gap:8px;margin:10px 0}.mp-btn{padding:6px 12px;border:none;border-radius:6px;cursor:pointer;font-size:.8rem;font-weight:600;font-family:inherit}.mp-btn.p{background:#00d4aa;color:#0a0a0f}.mp-btn.s{background:rgba(255,255,255,.1);color:#e8e8f0;border:1px solid rgba(255,255,255,.18)}.mp-range{flex:1}.mp-vol{display:flex;align-items:center;gap:8px;margin-top:8px;font-size:.74rem;color:#9898a8}.mp-list{margin-top:12px;display:flex;flex-direction:column;gap:6px}.mp-item{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-radius:7px;background:rgba(255,255,255,.03);border:1px solid transparent;cursor:pointer}.mp-item:hover{border-color:rgba(255,255,255,.15)}.mp-item.active{border-color:rgba(0,212,170,.6);background:rgba(0,212,170,.08)}.mp-item-meta{font-size:.72rem;color:#9898a8;margin-top:2px}.mp-status{font-size:.72rem;color:#9898a8;margin-top:8px;min-height:1.2em}</style><div class="mp"><div class="mp-title">Media Player</div><div class="mp-sub">Template with generated demo audio and a playlist UI.</div><div class="mp-card"><div class="mp-now" id="mp-now"></div><div class="mp-artist" id="mp-artist"></div><audio id="mp-audio"></audio><input class="mp-range" id="mp-seek" type="range" min="0" max="100" value="0"><div class="mp-controls"><button class="mp-btn s" id="mp-prev">Prev</button><button class="mp-btn p" id="mp-play">Play</button><button class="mp-btn s" id="mp-next">Next</button></div><div class="mp-vol">Volume <input class="mp-range" id="mp-vol" type="range" min="0" max="100" value="75"></div><div class="mp-status" id="mp-status">Ready</div><div class="mp-list" id="mp-list"></div></div></div>';
var audio=document.getElementById('mp-audio');audio.volume=.75;
function drawList(){document.getElementById('mp-list').innerHTML=TRACKS.map(function(t,i){return '<div class="mp-item'+(i===idx?' active':'')+'" data-i="'+i+'"><div><div style="font-size:.8rem">'+t.title+'</div><div class="mp-item-meta">'+t.artist+'</div></div><div style="font-size:.7rem;color:#9898a8">'+(i===idx?'Loaded':'Queue')+'</div></div>';}).join('');document.querySelectorAll('.mp-item').forEach(function(el){el.onclick=function(){idx=parseInt(this.dataset.i,10)||0;loadCurrent(true);};});}
function loadCurrent(autoplay){var t=TRACKS[idx];document.getElementById('mp-now').textContent=t.title;document.getElementById('mp-artist').textContent=t.artist;audio.src=t.url;audio.currentTime=0;document.getElementById('mp-seek').value=0;drawList();if(autoplay){audio.play();}}
document.getElementById('mp-play').onclick=async function(){if(audio.paused){try{await audio.play();}catch(_e){document.getElementById('mp-status').textContent='Autoplay blocked. Click Play again.';}}else{audio.pause();}};
document.getElementById('mp-prev').onclick=function(){idx=(idx-1+TRACKS.length)%TRACKS.length;loadCurrent(true);};
document.getElementById('mp-next').onclick=function(){idx=(idx+1)%TRACKS.length;loadCurrent(true);};
document.getElementById('mp-seek').oninput=function(){if(!audio.duration)return;audio.currentTime=(parseFloat(this.value)/100)*audio.duration;};
document.getElementById('mp-vol').oninput=function(){audio.volume=Math.max(0,Math.min(1,parseFloat(this.value)/100));};
audio.addEventListener('timeupdate',function(){if(!audio.duration)return;document.getElementById('mp-seek').value=Math.round((audio.currentTime/audio.duration)*100);});
audio.addEventListener('play',function(){document.getElementById('mp-play').textContent='Pause';document.getElementById('mp-status').textContent='Playing';});
audio.addEventListener('pause',function(){document.getElementById('mp-play').textContent='Play';if(audio.currentTime<audio.duration)document.getElementById('mp-status').textContent='Paused';});
audio.addEventListener('ended',function(){document.getElementById('mp-status').textContent='Track ended';idx=(idx+1)%TRACKS.length;loadCurrent(true);});
loadCurrent(false);`
            }
        ];

        return {
            html: `
                <style>
                    .am-root { height: 100%; display: flex; flex-direction: column; overflow: hidden; }
                    .am-hdr { display: flex; justify-content: space-between; align-items: center; padding: 0 0 12px 0; border-bottom: 1px solid var(--border); flex-shrink: 0; }
                    .am-hdr h2 { font-size: 1.05rem; display: flex; align-items: center; gap: 10px; }
                    .am-hdr h2 svg { width: 18px; height: 18px; }
                    .am-hdr-right { display: flex; align-items: center; gap: 8px; }
                    .am-count { font-size: 0.72rem; background: var(--bg-tertiary); padding: 3px 9px; border-radius: 10px; color: var(--fg-muted); }
                    .am-tabs { display: flex; border-bottom: 1px solid var(--border); flex-shrink: 0; margin-top: 12px; }
                    .am-tab { padding: 9px 16px; font-size: 0.85rem; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s; color: var(--fg-muted); }
                    .am-tab:hover { color: var(--fg-primary); }
                    .am-tab.active { border-bottom-color: var(--accent); color: var(--accent); }
                    .am-body { flex: 1; overflow-y: auto; padding-top: 14px; }

                    /* â”€â”€ My Apps â”€â”€ */
                    .am-section { margin-bottom: 20px; }
                    .am-section-hdr { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
                    .am-section-title { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 1px; color: var(--fg-muted); }
                    .am-app-item { display: flex; align-items: center; gap: 14px; padding: 11px 12px; background: rgba(0,0,0,0.2); border-radius: var(--radius-md); margin-bottom: 8px; border: 1px solid transparent; transition: all 0.2s; }
                    .am-app-item:hover { background: rgba(0,0,0,0.3); border-color: var(--border); }
                    .am-app-icon { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: var(--bg-tertiary); border-radius: var(--radius-sm); flex-shrink: 0; }
                    .am-app-icon svg { width: 22px; height: 22px; }
                    .am-app-info { flex: 1; min-width: 0; }
                    .am-app-name { font-weight: 500; font-size: 0.88rem; margin-bottom: 2px; display: flex; align-items: center; gap: 6px; }
                    .am-app-meta { font-size: 0.7rem; color: var(--fg-muted); }
                    .am-app-actions { display: flex; gap: 6px; flex-shrink: 0; }
                    .am-app-actions button { padding: 5px 11px; font-size: 0.73rem; border-radius: var(--radius-sm); }
                    .am-run-btn { background: var(--accent); color: var(--bg-primary); border: none; }
                    .am-run-btn:hover { background: var(--accent-hover); }
                    .am-edit-btn { background: transparent; border: 1px solid var(--border); color: var(--fg-secondary); }
                    .am-edit-btn:hover { background: var(--bg-tertiary); color: var(--fg-primary); }
                    .am-uninstall-btn { background: transparent; border: 1px solid var(--danger); color: var(--danger); }
                    .am-uninstall-btn:hover { background: rgba(255,77,106,0.1); }
                    .am-publish-btn { background: transparent; border: 1px solid rgba(167,139,250,.5); color: #a78bfa; }
                    .am-publish-btn:hover { background: rgba(167,139,250,.1); }
                    .am-user-badge { font-size: 0.6rem; background: rgba(0,212,170,0.15); color: var(--accent); padding: 2px 6px; border-radius: 4px; }
                    .am-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 180px; color: var(--fg-muted); text-align: center; gap: 8px; }
                    .am-empty svg { width: 44px; height: 44px; opacity: 0.25; }

                    /* â”€â”€ Marketplace â”€â”€ */
                    .mkt-toolbar { display: flex; gap: 10px; margin-bottom: 14px; }
                    .mkt-search { flex: 1; padding: 8px 12px; background: rgba(0,0,0,.3); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--fg-primary); font-size: 0.85rem; outline: none; font-family: inherit; }
                    .mkt-search:focus { border-color: var(--accent); }
                    .mkt-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
                    .mkt-card { background: rgba(0,0,0,.25); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 14px; display: flex; flex-direction: column; gap: 10px; transition: border-color 0.2s; }
                    .mkt-card:hover { border-color: rgba(255,255,255,.15); }
                    .mkt-card-top { display: flex; align-items: flex-start; gap: 12px; }
                    .mkt-card-icon { width: 44px; height: 44px; border-radius: var(--radius-sm); background: var(--bg-tertiary); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                    .mkt-card-icon svg { width: 22px; height: 22px; }
                    .mkt-card-meta { flex: 1; min-width: 0; }
                    .mkt-card-name { font-weight: 600; font-size: 0.88rem; margin-bottom: 2px; }
                    .mkt-card-author { font-size: 0.72rem; color: var(--fg-muted); }
                    .mkt-card-desc { font-size: 0.8rem; color: var(--fg-secondary); line-height: 1.5; }
                    .mkt-shot { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--border); background: rgba(0,0,0,.2); }
                    .mkt-card-footer { display: flex; align-items: center; justify-content: space-between; }
                    .mkt-badge { font-size: 0.65rem; padding: 2px 7px; border-radius: 4px; background: var(--bg-tertiary); color: var(--fg-muted); text-transform: capitalize; }
                    .mkt-links { display: flex; gap: 8px; flex-wrap: wrap; margin-top: -2px; }
                    .mkt-link { font-size: 0.72rem; color: var(--accent); text-decoration: none; }
                    .mkt-link:hover { text-decoration: underline; }
                    .mkt-install-btn { padding: 5px 14px; font-size: 0.75rem; border-radius: var(--radius-sm); background: var(--accent); color: var(--bg-primary); border: none; cursor: pointer; font-weight: 600; transition: all 0.2s; }
                    .mkt-install-btn:hover { background: var(--accent-hover); }
                    .mkt-install-btn:disabled { opacity: 0.5; cursor: default; }
                    .mkt-install-btn.installed { background: transparent; border: 1px solid var(--accent); color: var(--accent); cursor: default; }
                    .mkt-loading { display: flex; align-items: center; justify-content: center; height: 160px; color: var(--fg-muted); gap: 10px; }
                    .mkt-empty { text-align: center; padding: 32px 16px; }
                    .mkt-empty-icon { width: 52px; height: 52px; opacity: 0.2; margin: 0 auto 16px; }
                    .mkt-empty-title { font-size: 1rem; color: var(--fg-secondary); margin-bottom: 8px; }
                    .mkt-empty-desc { font-size: 0.82rem; color: var(--fg-muted); line-height: 1.6; margin-bottom: 16px; }
                    .mkt-empty-url { font-size: 0.78rem; color: var(--accent); font-family: monospace; background: var(--bg-tertiary); padding: 6px 10px; border-radius: 4px; display: inline-block; margin-bottom: 16px; }
                    .mkt-cta-row { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }

                    /* â”€â”€ New App â”€â”€ */
                    .na-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
                    .na-card { background: rgba(0,0,0,.25); border: 2px solid var(--border); border-radius: var(--radius-md); padding: 14px; cursor: pointer; transition: all 0.2s; text-align: center; }
                    .na-card:hover { border-color: rgba(255,255,255,.2); transform: translateY(-2px); }
                    .na-card.selected { border-color: var(--accent); background: rgba(0,212,170,.07); }
                    .na-card-icon { width: 40px; height: 40px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; margin: 0 auto 10px; }
                    .na-card-icon svg { width: 20px; height: 20px; }
                    .na-card-name { font-weight: 600; font-size: 0.85rem; margin-bottom: 4px; }
                    .na-card-desc { font-size: 0.72rem; color: var(--fg-muted); line-height: 1.4; }
                    .na-form { background: rgba(0,0,0,.2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 16px; }
                    .na-form-title { font-size: 0.85rem; color: var(--fg-secondary); margin-bottom: 12px; }
                    .na-form-row { display: flex; gap: 10px; align-items: flex-end; }
                    .na-form-label { display: block; font-size: 0.8rem; color: var(--fg-muted); margin-bottom: 6px; }
                    .na-input { flex: 1; padding: 8px 12px; background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--fg-primary); font-size: 0.88rem; outline: none; font-family: inherit; }
                    .na-input:focus { border-color: var(--accent); }
                    .na-create-btn { padding: 8px 18px; background: var(--accent); color: var(--bg-primary); border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: 0.85rem; font-weight: 600; white-space: nowrap; }
                    .na-create-btn:hover { background: var(--accent-hover); }
                    .na-create-btn:disabled { opacity: 0.5; cursor: default; }

                    /* â”€â”€ Publish overlay â”€â”€ */
                    .am-overlay { position: absolute; inset: 0; background: rgba(0,0,0,.7); display: flex; align-items: center; justify-content: center; z-index: 10; backdrop-filter: blur(4px); }
                    .am-modal { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius-lg); width: 90%; max-width: 500px; max-height: 80%; display: flex; flex-direction: column; }
                    .am-modal-hdr { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
                    .am-modal-hdr h3 { font-size: 0.95rem; }
                    .am-modal-close { background: transparent; border: none; color: var(--fg-muted); font-size: 1.3rem; cursor: pointer; line-height: 1; padding: 0 4px; }
                    .am-modal-close:hover { color: var(--fg-primary); }
                    .am-modal-body { padding: 16px; overflow-y: auto; }
                    .am-manifest-pre { background: rgba(0,0,0,.4); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px; font-family: monospace; font-size: 0.75rem; color: var(--fg-secondary); overflow: auto; max-height: 180px; margin-bottom: 12px; white-space: pre; }
                    .am-modal-actions { display: flex; gap: 8px; flex-wrap: wrap; }
                    .am-modal-desc { font-size: 0.82rem; color: var(--fg-secondary); margin-bottom: 12px; line-height: 1.5; }
                    .am-modal-steps { font-size: 0.8rem; color: var(--fg-muted); line-height: 1.8; margin-bottom: 12px; }
                    .am-modal-field { margin-bottom: 10px; }
                    .am-modal-label { display: block; font-size: 0.75rem; color: var(--fg-muted); margin-bottom: 4px; }
                    .am-modal-input { width: 100%; box-sizing: border-box; background: rgba(0,0,0,.35); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--fg-primary); padding: 7px 10px; font-size: 0.82rem; font-family: inherit; outline: none; }
                    .am-modal-input:focus { border-color: var(--accent); }

                    @media (max-width: 780px) {
                        .mkt-grid { grid-template-columns: 1fr; }
                        .na-grid { grid-template-columns: 1fr 1fr; }
                    }
                </style>
                <div class="am-root" style="position:relative;" id="am-root-${windowId}">
                    <div class="am-hdr">
                        <h2>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                            App Manager
                        </h2>
                        <div class="am-hdr-right">
                            <span class="am-count" id="am-count-${windowId}">0 apps</span>
                        </div>
                    </div>
                    <div class="am-tabs">
                        <div class="am-tab active" data-am-tab="${windowId}" data-tab="myapps">My Apps</div>
                        <div class="am-tab" data-am-tab="${windowId}" data-tab="marketplace">Marketplace</div>
                        <div class="am-tab" data-am-tab="${windowId}" data-tab="newapp">+ New App</div>
                    </div>
                    <div class="am-body" id="am-body-${windowId}"></div>
                    <div class="am-overlay" id="am-overlay-${windowId}" style="display:none"></div>
                </div>
            `,
            init: () => {
                const lifecycle = createAppLifecycle();
                const esc  = s => window.EphemeraSanitize ? EphemeraSanitize.escapeHtml(String(s ?? '')) : String(s ?? '');
                const escA = s => window.EphemeraSanitize ? EphemeraSanitize.escapeAttr(String(s ?? '')) : String(s ?? '');

                const homeDir       = EphemeraFS?.homeDir || EphemeraState?.user?.homeDir || '/home/user';
                const body          = document.getElementById(`am-body-${windowId}`);
                const overlay       = document.getElementById(`am-overlay-${windowId}`);
                const countBadge    = document.getElementById(`am-count-${windowId}`);
                let   activeTab     = 'myapps';
                let   marketCache   = null;
                let   selectedTpl   = null;
                let   marketplaceRequestId = 0;

                // â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                function isUserApp(app) {
                    return app.isUserApp === true || app.category === 'user' || String(app.id).startsWith('com.user.');
                }

                function slugify(text) {
                    return String(text || '')
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-+|-+$/g, '')
                        .substring(0, 64) || 'app';
                }

                function sanitizeRemoteUrl(url, baseUrl) {
                    const raw = String(url || '').trim();
                    if (!raw) return '';
                    const sanitized = window.EphemeraSanitize?.sanitizeUrl ? EphemeraSanitize.sanitizeUrl(raw) : raw;
                    if (!sanitized) return '';
                    try {
                        const parsed = new URL(sanitized, baseUrl || window.location.origin);
                        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
                        return parsed.toString();
                    } catch (_e) {
                        return '';
                    }
                }

                function sanitizeIconMarkup(icon) {
                    const markup = String(icon || '').trim();
                    if (!markup) return '';
                    if (!/^<svg[\s>]/i.test(markup)) return '';
                    if (markup.length > 10000) return '';
                    if (/<script|on\w+\s*=|javascript:/i.test(markup)) return '';
                    return markup;
                }

                async function fetchWithTimeout(url, timeoutMs, options = {}) {
                    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
                        return fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
                    }
                    if (typeof AbortController === 'undefined') {
                        return fetch(url, options);
                    }
                    const controller = new AbortController();
                    const timer = setTimeout(() => controller.abort(), timeoutMs);
                    try {
                        return await fetch(url, { ...options, signal: controller.signal });
                    } finally {
                        clearTimeout(timer);
                    }
                }

                function updateCount() {
                    const all = EphemeraApps.getAll();
                    countBadge.textContent = all.filter(a => a.category !== 'hidden').length + ' apps';
                }

                // â”€â”€ Tab switching â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                function showTab(name) {
                    marketplaceRequestId++;
                    activeTab = name;
                    document.querySelectorAll(`[data-am-tab="${windowId}"]`).forEach(t => {
                        t.classList.toggle('active', t.dataset.tab === name);
                    });
                    overlay.style.display = 'none';
                    body.innerHTML = '';
                    if (name === 'myapps')      renderMyApps();
                    else if (name === 'marketplace') renderMarketplace();
                    else if (name === 'newapp') renderNewApp();
                }

                lifecycle.addListener(
                    document.getElementById(`am-root-${windowId}`),
                    'click',
                    e => {
                        const tab = e.target.closest('[data-am-tab]');
                        if (tab) showTab(tab.dataset.tab);
                    }
                );

                // â”€â”€ MY APPS TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                function renderMyApps() {
                    updateCount();
                    const all        = EphemeraApps.getAll();
                    const userApps   = all.filter(a => isUserApp(a));
                    const systemApps = all.filter(a => !isUserApp(a) && a.category !== 'hidden');

                    let html = '';

                    if (userApps.length > 0) {
                        html += `<div class="am-section">
                            <div class="am-section-hdr">
                                <span class="am-section-title">My Apps</span>
                                <span style="font-size:0.7rem;color:var(--fg-muted)">${userApps.length} installed</span>
                            </div>
                            ${userApps.map(app => renderAppItem(app, true)).join('')}
                        </div>`;
                    }

                    if (systemApps.length > 0) {
                        html += `<div class="am-section">
                            <div class="am-section-hdr">
                                <span class="am-section-title">System Apps</span>
                                <span style="font-size:0.7rem;color:var(--fg-muted)">${systemApps.length} built-in</span>
                            </div>
                            ${systemApps.map(app => renderAppItem(app, false)).join('')}
                        </div>`;
                    }

                    if (!html) {
                        html = `<div class="am-empty">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                            <p>No apps yet</p>
                            <button class="btn btn-sm" id="am-goto-new-${windowId}">Create your first app â†’</button>
                        </div>`;
                    }

                    body.innerHTML = html;

                    body.querySelector(`#am-goto-new-${windowId}`)?.addEventListener('click', () => showTab('newapp'));

                    body.querySelectorAll('.am-run-btn').forEach(btn => {
                        btn.addEventListener('click', () => EphemeraWM.open(btn.dataset.appId));
                    });

                    body.querySelectorAll('.am-edit-btn').forEach(btn => {
                        btn.addEventListener('click', () => {
                            const appDirName = btn.dataset.appId.replace('com.user.', '');
                            EphemeraWM.open('code', { filePath: `${homeDir}/apps/${appDirName}/app.js` });
                        });
                    });

                    body.querySelectorAll('.am-uninstall-btn').forEach(btn => {
                        btn.addEventListener('click', async () => {
                            const appId = btn.dataset.appId;
                            const app   = EphemeraApps.get(appId);
                            if (await EphemeraDialog.confirm(
                                `Uninstall "<strong>${esc(app?.name || appId)}</strong>"?<br><br><small style="color:var(--fg-muted)">Files stay in ${homeDir}/apps/</small>`,
                                'Uninstall App',
                                true
                            )) {
                                await EphemeraApps.uninstallApp(appId);
                                renderMyApps();
                                if (window.EphemeraBoot) EphemeraBoot.updateStartMenu();
                                EphemeraNotifications.success('Uninstalled', `${app?.name || appId} removed.`);
                            }
                        });
                    });

                    body.querySelectorAll('.am-publish-btn').forEach(btn => {
                        btn.addEventListener('click', () => showPublishModal(btn.dataset.appId));
                    });
                }

                function renderAppItem(app, isUser) {
                    const desc = app.description ? app.description.substring(0, 50) + (app.description.length > 50 ? 'â€¦' : '') : '';
                    return `<div class="am-app-item">
                        <div class="am-app-icon">${app.icon}</div>
                        <div class="am-app-info">
                            <div class="am-app-name">
                                ${esc(app.name)}
                                ${isUser ? '<span class="am-user-badge">USER</span>' : ''}
                            </div>
                            <div class="am-app-meta">${esc(app.id)}${desc ? ' Â· ' + esc(desc) : ''}</div>
                        </div>
                        <div class="am-app-actions">
                            <button class="am-run-btn" data-app-id="${escA(app.id)}">Run</button>
                            ${isUser ? `<button class="am-edit-btn" data-app-id="${escA(app.id)}">Edit</button>` : ''}
                            ${isUser ? `<button class="am-publish-btn" data-app-id="${escA(app.id)}">Publish</button>` : ''}
                            ${isUser ? `<button class="am-uninstall-btn" data-app-id="${escA(app.id)}">Remove</button>` : ''}
                        </div>
                    </div>`;
                }

                // â”€â”€ MARKETPLACE TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                function normalizeRegistryEntries(payload, registryUrl) {
                    const source = Array.isArray(payload) ? payload : (Array.isArray(payload?.apps) ? payload.apps : []);
                    return source.map(raw => {
                        if (!raw || typeof raw !== 'object') return null;
                        const name = String(raw.name || '').trim();
                        if (!name) return null;
                        const author = String(raw.author || raw.publisher || 'community').trim() || 'community';
                        const installUrl = sanitizeRemoteUrl(raw.install_url || raw.installUrl || raw.code_url || raw.codeUrl, registryUrl);
                        const codeUrl = sanitizeRemoteUrl(raw.code_url || raw.codeUrl || '', registryUrl);
                        const manifestUrl = sanitizeRemoteUrl(raw.manifest_url || raw.manifestUrl || '', registryUrl);
                        if (!installUrl && !codeUrl && !manifestUrl) return null;
                        const id = String(raw.id || `com.community.${slugify(`${author}-${name}`)}`).trim();
                        const reviewsUrl = sanitizeRemoteUrl(raw.reviews_url || raw.review_url || raw.discussion_url || raw.discussions_url, registryUrl)
                            || `${REGISTRY_DISCUSSIONS}?discussions_q=${encodeURIComponent(id || name)}`;
                        return {
                            id,
                            name,
                            author,
                            description: String(raw.description || ''),
                            version: String(raw.version || '1.0.0'),
                            icon: sanitizeIconMarkup(raw.icon),
                            category: String(raw.category || 'community'),
                            permissions: Array.isArray(raw.permissions) ? raw.permissions : [],
                            window: (raw.window && typeof raw.window === 'object') ? raw.window : null,
                            installUrl: installUrl || codeUrl,
                            codeUrl,
                            manifestUrl,
                            screenshotUrl: sanitizeRemoteUrl(raw.screenshot_url || raw.screenshot || raw.screenshotUrl || '', registryUrl),
                            sourceUrl: sanitizeRemoteUrl(raw.repo_url || raw.repository_url || raw.source_url || raw.homepage || raw.url || '', registryUrl),
                            reviewsUrl
                        };
                    }).filter(Boolean);
                }

                async function fetchRegistryEntries() {
                    let lastError = null;
                    for (const url of [REGISTRY_URL, REGISTRY_FALLBACK_URL]) {
                        try {
                            const resp = await fetchWithTimeout(url, 6000);
                            if (!resp.ok) throw new Error(`Registry request failed (${resp.status})`);
                            const payload = await resp.json();
                            return normalizeRegistryEntries(payload, url);
                        } catch (e) {
                            lastError = e;
                        }
                    }
                    throw lastError || new Error('Failed to load marketplace registry.');
                }

                async function renderMarketplace() {
                    const requestId = ++marketplaceRequestId;
                    body.innerHTML = `<div class="mkt-loading">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
                        <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
                        Fetching registry...
                    </div>`;

                    let fetchError = null;
                    if (!marketCache) {
                        try {
                            marketCache = await fetchRegistryEntries();
                        } catch (e) {
                            marketCache = null;
                            fetchError = e;
                        }
                    }

                    if (requestId !== marketplaceRequestId || activeTab !== 'marketplace') return;

                    if (!marketCache || marketCache.length === 0) {
                        renderMarketplaceEmpty({ fetchError });
                        return;
                    }

                    renderMarketplaceApps(marketCache);
                }

                function renderMarketplaceEmpty(options = {}) {
                    const unavailable = !!options.fetchError;
                    body.innerHTML = `<div class="mkt-empty">
                        <svg class="mkt-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-10 2a2 2 0 100 4 2 2 0 000-4z"/></svg>
                        <div class="mkt-empty-title">${unavailable ? 'Marketplace Unavailable' : 'Marketplace Coming Soon'}</div>
                        <div class="mkt-empty-desc">
                            ${unavailable
                                ? 'Could not load the community registry right now. Check your connection and try again.'
                                : 'The community registry will host apps built by Ephemera users.<br>Be the first to publish an app!'}
                        </div>
                        <div class="mkt-empty-url">${esc(REGISTRY_URL)}</div>
                        ${unavailable ? '' : `<div class="mkt-empty-desc" style="font-size:0.78rem">
                            To add your app to the marketplace:<br>
                            1. Create your app using <strong>New App</strong> or the Code Editor<br>
                            2. Click <strong>Publish</strong> on your app in <strong>My Apps</strong><br>
                            3. Submit a pull request to the registry repo
                        </div>`}
                        <div class="mkt-cta-row">
                            <button class="btn btn-sm" id="mkt-goto-new-${windowId}">+ Create an App</button>
                            <button class="btn btn-sm" id="mkt-refresh-${windowId}">Refresh</button>
                            <a href="${escA(REGISTRY_REPO)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm" style="text-decoration:none">View Registry on GitHub</a>
                            <a href="${escA(REGISTRY_DISCUSSIONS)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm" style="text-decoration:none">Community Reviews</a>
                        </div>
                    </div>`;

                    body.querySelector(`#mkt-goto-new-${windowId}`)?.addEventListener('click', () => showTab('newapp'));
                    body.querySelector(`#mkt-refresh-${windowId}`)?.addEventListener('click', () => {
                        marketCache = null;
                        renderMarketplace();
                    });
                }

                function renderMarketplaceApps(apps) {
                    body.innerHTML = `
                        <div class="mkt-toolbar">
                            <input class="mkt-search" id="mkt-search-${windowId}" placeholder="Search marketplace...">
                            <a href="${escA(REGISTRY_DISCUSSIONS)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm" style="text-decoration:none">Reviews</a>
                        </div>
                        <div class="mkt-grid" id="mkt-grid-${windowId}"></div>
                    `;

                    let filter = '';
                    const grid = document.getElementById(`mkt-grid-${windowId}`);

                    function renderGrid() {
                        const q = filter.toLowerCase();
                        const visible = apps.filter(a => {
                            const haystack = [
                                a.name,
                                a.description || '',
                                a.author || '',
                                a.category || ''
                            ].join(' ').toLowerCase();
                            return !q || haystack.includes(q);
                        });

                        if (visible.length === 0) {
                            grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--fg-muted)">No apps match your search.</div>`;
                            return;
                        }

                        grid.innerHTML = visible.map(app => {
                            const alreadyInstalled = !!EphemeraApps.get(app.id);
                            const defaultIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="3"/></svg>`;
                            const links = [
                                app.sourceUrl ? `<a class="mkt-link" href="${escA(app.sourceUrl)}" target="_blank" rel="noopener noreferrer">Source</a>` : '',
                                app.reviewsUrl ? `<a class="mkt-link" href="${escA(app.reviewsUrl)}" target="_blank" rel="noopener noreferrer">Reviews</a>` : ''
                            ].filter(Boolean).join('');
                            return `<div class="mkt-card">
                                <div class="mkt-card-top">
                                    <div class="mkt-card-icon">${app.icon || defaultIcon}</div>
                                    <div class="mkt-card-meta">
                                        <div class="mkt-card-name">${esc(app.name)}</div>
                                        <div class="mkt-card-author">by ${esc(app.author || 'community')} - v${esc(app.version || '1.0.0')}</div>
                                    </div>
                                </div>
                                <div class="mkt-card-desc">${esc((app.description || '').substring(0, 120))}</div>
                                ${app.screenshotUrl ? `<img class="mkt-shot" src="${escA(app.screenshotUrl)}" alt="Screenshot for ${escA(app.name)}">` : ''}
                                ${links ? `<div class="mkt-links">${links}</div>` : ''}
                                <div class="mkt-card-footer">
                                    <span class="mkt-badge">${esc(app.category || 'app')}</span>
                                    <button
                                        class="mkt-install-btn${alreadyInstalled ? ' installed' : ''}"
                                        data-app-id="${escA(app.id)}"
                                        ${alreadyInstalled ? 'disabled' : ''}
                                    >${alreadyInstalled ? 'Installed' : 'Install'}</button>
                                </div>
                            </div>`;
                        }).join('');

                        grid.querySelectorAll('.mkt-install-btn:not(.installed)').forEach(btn => {
                            btn.addEventListener('click', async () => {
                                const appId = btn.dataset.appId;
                                const entry = apps.find(a => a.id === appId);
                                if (!entry) return;
                                btn.disabled = true;
                                btn.textContent = 'Installing...';
                                try {
                                    const installed = await installFromRegistry(entry);
                                    if (installed?.id) entry.id = installed.id;
                                    updateCount();
                                    renderGrid();
                                } catch (e) {
                                    btn.disabled = false;
                                    btn.textContent = 'Install';
                                    EphemeraNotifications.error('Install Failed', e.message);
                                }
                            });
                        });
                    }

                    document.getElementById(`mkt-search-${windowId}`)?.addEventListener('input', e => {
                        filter = e.target.value;
                        renderGrid();
                    });

                    renderGrid();
                }

                async function installFromRegistry(entry) {
                    const installUrl = entry.installUrl || entry.codeUrl;
                    if (!installUrl && !entry.manifestUrl) throw new Error('Registry entry is missing install metadata.');

                    let code = '';
                    let manifestFromPackage = null;

                    if (installUrl) {
                        const resp = await fetchWithTimeout(installUrl, 15000);
                        if (!resp.ok) throw new Error(`Failed to fetch install package (HTTP ${resp.status})`);
                        const payloadText = await resp.text();

                        let parsed = null;
                        try { parsed = JSON.parse(payloadText); } catch (_e) { parsed = null; }

                        if (parsed && typeof parsed === 'object') {
                            if (parsed.manifest && typeof parsed.manifest === 'object') {
                                manifestFromPackage = parsed.manifest;
                            } else if (parsed.id || parsed.name || parsed.window || parsed.permissions || parsed.version) {
                                manifestFromPackage = parsed;
                            }

                            if (typeof parsed.code === 'string') {
                                code = parsed.code;
                            }

                            const nestedCodeUrl = sanitizeRemoteUrl(parsed.code_url || parsed.codeUrl || parsed.install_url || parsed.installUrl);
                            if (!code && nestedCodeUrl && nestedCodeUrl !== installUrl) {
                                const nestedResp = await fetchWithTimeout(nestedCodeUrl, 15000);
                                if (!nestedResp.ok) throw new Error(`Failed to fetch app code (HTTP ${nestedResp.status})`);
                                code = await nestedResp.text();
                            }
                        } else {
                            code = payloadText;
                        }
                    }

                    if (!manifestFromPackage && entry.manifestUrl) {
                        const manifestResp = await fetchWithTimeout(entry.manifestUrl, 10000);
                        if (!manifestResp.ok) throw new Error(`Failed to fetch manifest (HTTP ${manifestResp.status})`);
                        manifestFromPackage = await manifestResp.json();
                    }

                    if (!code && entry.codeUrl && entry.codeUrl !== installUrl) {
                        const codeResp = await fetchWithTimeout(entry.codeUrl, 15000);
                        if (!codeResp.ok) throw new Error(`Failed to fetch app code (HTTP ${codeResp.status})`);
                        code = await codeResp.text();
                    }

                    if (!code || !code.trim()) {
                        throw new Error('Install package did not contain executable app code.');
                    }

                    const fallbackId = entry.id || `com.community.${slugify(`${entry.author}-${entry.name}`)}`;
                    const manifest = {
                        id: String(manifestFromPackage?.id || fallbackId),
                        name: String(manifestFromPackage?.name || entry.name || fallbackId),
                        description: String(manifestFromPackage?.description || entry.description || ''),
                        version: String(manifestFromPackage?.version || entry.version || '1.0.0'),
                        icon: sanitizeIconMarkup(manifestFromPackage?.icon || entry.icon || ''),
                        category: manifestFromPackage?.category || entry.category || 'user',
                        permissions: Array.isArray(manifestFromPackage?.permissions) ? manifestFromPackage.permissions : entry.permissions || [],
                        window: (manifestFromPackage?.window && typeof manifestFromPackage.window === 'object')
                            ? manifestFromPackage.window
                            : (entry.window || { width: 600, height: 400 }),
                        singleton: Boolean(manifestFromPackage?.singleton)
                    };

                    if (!/^[\w.-]+$/.test(manifest.id)) {
                        manifest.id = `com.community.${slugify(manifest.id)}`;
                    }
                    if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
                        manifest.version = '1.0.0';
                    }

                    const installed = await EphemeraApps.installApp(manifest, code);
                    if (window.EphemeraBoot) EphemeraBoot.updateStartMenu();
                    EphemeraNotifications.success('Installed', `${installed?.name || manifest.name} is ready.`);
                    return installed;
                }

                // â”€â”€ NEW APP TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                function renderNewApp() {
                    selectedTpl = null;
                    const grid = TEMPLATES.map(t => `
                        <div class="na-card" data-tpl-id="${escA(t.id)}">
                            <div class="na-card-icon" style="background:${t.color}22;">${t.icon}</div>
                            <div class="na-card-name">${esc(t.name)}</div>
                            <div class="na-card-desc">${esc(t.description)}</div>
                        </div>
                    `).join('');

                    body.innerHTML = `
                        <div class="na-grid" id="na-grid-${windowId}">${grid}</div>
                        <div class="na-form" id="na-form-${windowId}" style="display:none">
                            <div class="na-form-title" id="na-form-title-${windowId}">Configure your app</div>
                            <label class="na-form-label">App name</label>
                            <div class="na-form-row">
                                <input class="na-input" id="na-name-${windowId}" placeholder="My Awesome App" maxlength="60">
                                <button class="na-create-btn" id="na-create-${windowId}">Create App</button>
                            </div>
                        </div>
                    `;

                    body.querySelectorAll('.na-card').forEach(card => {
                        card.addEventListener('click', () => {
                            body.querySelectorAll('.na-card').forEach(c => c.classList.remove('selected'));
                            card.classList.add('selected');
                            selectedTpl = TEMPLATES.find(t => t.id === card.dataset.tplId);
                            const form = document.getElementById(`na-form-${windowId}`);
                            const title = document.getElementById(`na-form-title-${windowId}`);
                            form.style.display = 'block';
                            title.textContent = `Name your ${selectedTpl.name} app`;
                            document.getElementById(`na-name-${windowId}`).focus();
                        });
                    });

                    document.getElementById(`na-create-${windowId}`)?.addEventListener('click', async () => {
                        if (!selectedTpl) return;
                        const rawName = (document.getElementById(`na-name-${windowId}`)?.value || '').trim();
                        const name    = rawName || selectedTpl.name;
                        const btn     = document.getElementById(`na-create-${windowId}`);
                        btn.disabled  = true;
                        btn.textContent = 'Creatingâ€¦';
                        try {
                            await createFromTemplate(selectedTpl, name);
                        } finally {
                            btn.disabled    = false;
                            btn.textContent = 'Create App';
                        }
                    });

                    document.getElementById(`na-name-${windowId}`)?.addEventListener('keydown', e => {
                        if (e.key === 'Enter') document.getElementById(`na-create-${windowId}`)?.click();
                    });
                }

                async function createFromTemplate(template, appName) {
                    const slug = appName
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-+|-+$/g, '')
                        .substring(0, 40) || template.id;

                    const manifest = {
                        id:          `com.user.${slug}`,
                        name:        appName,
                        description: template.description,
                        version:     '1.0.0',
                        icon:        template.icon,
                        category:    'user',
                        permissions: [],
                        window:      { width: 600, height: 480 }
                    };

                    await EphemeraApps.installApp(manifest, template.code);
                    if (window.EphemeraBoot) EphemeraBoot.updateStartMenu();
                    EphemeraNotifications.success('App Created', `"${appName}" is ready in My Apps.`);
                    showTab('myapps');
                }

                // â”€â”€ PUBLISH MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                function showPublishModal(appId) {
                    const app = EphemeraApps.get(appId);
                    if (!app) return;

                    const manifest = {
                        id: app.id,
                        name: app.name,
                        description: app.description || '',
                        author: '',
                        version: '1.0.0',
                        icon: app.icon || '',
                        category: app.category || 'user',
                        permissions: app.permissions || [],
                        window: { width: app.width || 600, height: app.height || 400 }
                    };

                    const manifestJson = JSON.stringify(manifest, null, 2);
                    const escapedJson = esc(manifestJson);
                    const defaultBranch = `app-${slugify(app.name)}`;
                    const forkUrl = `${REGISTRY_REPO}/fork`;

                    function sanitizeGitUser(value) {
                        return String(value || '').trim().replace(/[^A-Za-z0-9-]/g, '');
                    }

                    function sanitizeGitBranch(value) {
                        const cleaned = String(value || '').trim().replace(/[^A-Za-z0-9._/-]/g, '-').replace(/^-+|-+$/g, '');
                        return cleaned || defaultBranch;
                    }

                    function buildPrBody(githubUser, branchName) {
                        return [
                            '## App Submission',
                            '',
                            `- App: ${app.name}`,
                            `- Author GitHub: @${githubUser}`,
                            `- Branch: ${branchName}`,
                            '',
                            '## Manifest',
                            '```json',
                            manifestJson,
                            '```',
                            '',
                            '## Checklist',
                            '- [ ] I added my app entry to `apps.json` in my fork',
                            '- [ ] I included screenshot and install URL fields',
                            '- [ ] I tested installation from my fork branch',
                            '',
                            '## Notes',
                            'Describe what your app does and any permissions it needs.'
                        ].join('\n');
                    }

                    function buildPrUrl(githubUser, branchName) {
                        const title = encodeURIComponent(`[App Submission] ${app.name}`);
                        const body = encodeURIComponent(buildPrBody(githubUser, branchName));
                        return `${REGISTRY_REPO}/compare/main...${encodeURIComponent(githubUser)}:${encodeURIComponent(branchName)}?expand=1&title=${title}&body=${body}`;
                    }

                    overlay.innerHTML = `
                        <div class="am-modal">
                            <div class="am-modal-hdr">
                                <h3>Publish "${esc(app.name)}" to Marketplace</h3>
                                <button class="am-modal-close" id="am-modal-close-${windowId}">&times;</button>
                            </div>
                            <div class="am-modal-body">
                                <div class="am-modal-desc">
                                    Submit your app through a fork + pull request workflow so the community registry can review and merge it.
                                </div>
                                <div class="am-modal-steps">
                                    1. Fork the registry repository<br>
                                    2. Add your app entry and code URLs in your fork<br>
                                    3. Enter your GitHub username and branch below<br>
                                    4. Open a prefilled pull request
                                </div>

                                <div class="am-modal-field">
                                    <label class="am-modal-label" for="am-pub-user-${windowId}">GitHub username</label>
                                    <input class="am-modal-input" id="am-pub-user-${windowId}" placeholder="your-github-username" maxlength="39">
                                </div>
                                <div class="am-modal-field">
                                    <label class="am-modal-label" for="am-pub-branch-${windowId}">Fork branch</label>
                                    <input class="am-modal-input" id="am-pub-branch-${windowId}" value="${escA(defaultBranch)}" maxlength="120">
                                </div>
                                <div class="am-modal-field">
                                    <label class="am-modal-label" for="am-pr-preview-${windowId}">Prefilled PR URL</label>
                                    <input class="am-modal-input" id="am-pr-preview-${windowId}" readonly value="Enter your GitHub username to generate the PR link">
                                </div>

                                <div class="am-manifest-pre" id="am-manifest-pre-${windowId}">${escapedJson}</div>
                                <div class="am-modal-actions">
                                    <button class="btn btn-sm" id="am-copy-manifest-${windowId}">Copy Manifest</button>
                                    <button class="btn btn-sm" id="am-copy-pr-body-${windowId}">Copy PR Body</button>
                                    <button class="btn btn-sm" id="am-open-pr-${windowId}">Open Prefilled PR</button>
                                    <a class="btn btn-sm" href="${escA(forkUrl)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none">Fork Registry Repo</a>
                                    <a class="btn btn-sm" href="${escA(REGISTRY_DISCUSSIONS)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none">Community Reviews</a>
                                </div>
                            </div>
                        </div>
                    `;
                    overlay.style.display = 'flex';

                    const userInput = document.getElementById(`am-pub-user-${windowId}`);
                    const branchInput = document.getElementById(`am-pub-branch-${windowId}`);
                    const previewInput = document.getElementById(`am-pr-preview-${windowId}`);

                    const updatePreview = () => {
                        const user = sanitizeGitUser(userInput?.value);
                        const branch = sanitizeGitBranch(branchInput?.value);
                        if (!user) {
                            previewInput.value = 'Enter your GitHub username to generate the PR link';
                            return;
                        }
                        previewInput.value = buildPrUrl(user, branch);
                    };

                    const closeModal = () => {
                        overlay.style.display = 'none';
                        overlay.removeEventListener('click', onOverlayClick);
                    };

                    const onOverlayClick = (e) => {
                        if (e.target === overlay) closeModal();
                    };

                    document.getElementById(`am-modal-close-${windowId}`)?.addEventListener('click', closeModal);
                    overlay.addEventListener('click', onOverlayClick);

                    userInput?.addEventListener('input', updatePreview);
                    branchInput?.addEventListener('input', updatePreview);
                    updatePreview();

                    document.getElementById(`am-copy-manifest-${windowId}`)?.addEventListener('click', async () => {
                        try {
                            await navigator.clipboard.writeText(manifestJson);
                            const btn = document.getElementById(`am-copy-manifest-${windowId}`);
                            if (btn) {
                                btn.textContent = 'Copied';
                                setTimeout(() => { btn.textContent = 'Copy Manifest'; }, 1800);
                            }
                        } catch (_e) {
                            EphemeraNotifications.error('Copy Failed', 'Could not access clipboard.');
                        }
                    });

                    document.getElementById(`am-copy-pr-body-${windowId}`)?.addEventListener('click', async () => {
                        const user = sanitizeGitUser(userInput?.value) || 'your-github-username';
                        const branch = sanitizeGitBranch(branchInput?.value);
                        try {
                            await navigator.clipboard.writeText(buildPrBody(user, branch));
                            const btn = document.getElementById(`am-copy-pr-body-${windowId}`);
                            if (btn) {
                                btn.textContent = 'Copied';
                                setTimeout(() => { btn.textContent = 'Copy PR Body'; }, 1800);
                            }
                        } catch (_e) {
                            EphemeraNotifications.error('Copy Failed', 'Could not access clipboard.');
                        }
                    });

                    document.getElementById(`am-open-pr-${windowId}`)?.addEventListener('click', () => {
                        const user = sanitizeGitUser(userInput?.value);
                        if (!user) {
                            EphemeraNotifications.error('Missing GitHub Username', 'Enter your GitHub username first.');
                            userInput?.focus();
                            return;
                        }
                        const branch = sanitizeGitBranch(branchInput?.value);
                        window.open(buildPrUrl(user, branch), '_blank', 'noopener,noreferrer');
                    });
                }
                lifecycle.addSubscription(EphemeraEvents.on('app:installed', () => {
                    if (activeTab === 'myapps') renderMyApps();
                    if (activeTab === 'marketplace' && Array.isArray(marketCache)) renderMarketplaceApps(marketCache);
                    updateCount();
                }));
                lifecycle.addSubscription(EphemeraEvents.on('app:uninstalled', () => {
                    if (activeTab === 'myapps') renderMyApps();
                    if (activeTab === 'marketplace' && Array.isArray(marketCache)) renderMarketplaceApps(marketCache);
                    updateCount();
                }));

                // â”€â”€ Boot â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                showTab('myapps');

                return { destroy: () => lifecycle.destroy() };
            }
        };
    }
});


