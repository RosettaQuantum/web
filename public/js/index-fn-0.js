(function(){
  /* La animacion de las barras del recuadro "Ilustrativo · la forma de la
     victoria" se fue con el recuadro (decision de Nicholas): vendia una victoria
     cuantica que nuestro propio /v1/state desmiente con un 0. */
  var cb = document.getElementById('copyBtn');
  cb.addEventListener('click', function(){
    var t = document.getElementById('qs').textContent;
    if (navigator.clipboard) navigator.clipboard.writeText(t);
    cb.textContent = 'copied ✓';
    setTimeout(function(){ cb.textContent = 'copy'; }, 1600);
  });

  var FLAVORS = [
    // Rates derived from unit-economics model (Braket list prices Jul 2026, royalty = 4x break-even).
    // NO hay factor de victoria: se cobra POR MEDICION, gane o pierda. `advRate` existia para
    // expresar "solo cobramos las que ganan" y suponia 50-60% de victorias facturables mientras
    // /v1/state publica victorias_cuanticas_medidas: 0. Se retiro del modelo el 2026-08-24 con OK
    // de Nicholas, junto con el cobro condicional del texto. NO reintroducir con otro nombre: un
    // 0,60 renombrado a "tasa de filtrado" seria la misma cifra no medida respondiendo otra
    // pregunta. Si algun dia hace falta un factor, se mide primero.
    {id:"RQ-0012", name:"Portfolio optimization", q:"\u201cOptimal risk across N assets?\u201d",
     unit:"assets", min:50, max:2000, def:500, hwBase:12, hwPerUnit:0.006, royBase:55, royPerUnit:0.04},
    {id:"RQ-0007", name:"Molecular binding", q:"\u201cHow does this compound bind?\u201d",
     unit:"compounds / batch", min:100, max:10000, def:2000, hwBase:300, hwPerUnit:0.04, royBase:1500, royPerUnit:0.16},
    {id:"RQ-0019", name:"Fleet & route optimization", q:"\u201cRoute N vehicles, live constraints?\u201d",
     unit:"vehicles", min:10, max:500, def:80, hwBase:13, hwPerUnit:0.03, royBase:65, royPerUnit:0.15},
    {id:"RQ-0033", name:"Grid / energy balancing", q:"\u201cBalance N nodes with renewables?\u201d",
     unit:"grid nodes", min:100, max:5000, def:800, hwBase:20, hwPerUnit:0.005, royBase:100, royPerUnit:0.02}
  ];
  var sel = 0;
  var flavorsEl = document.getElementById('flavors');
  FLAVORS.forEach(function(f,i){
    var b = document.createElement('button');
    b.className = 'flavor' + (i===0?' sel':'');
    b.setAttribute('type','button');
    b.innerHTML = '<div class="f-name"><span>'+f.name+'</span><span class="f-id">'+f.id+'</span></div><div class="f-q">'+f.q+'</div>';
    b.addEventListener('click', function(){
      sel = i;
      document.querySelectorAll('.flavor').forEach(function(el,j){ el.classList.toggle('sel', j===i); });
      scale.value = 100*(f.def-f.min)/(f.max-f.min);
      update();
    });
    flavorsEl.appendChild(b);
  });
  var scale = document.getElementById('scale'), freq = document.getElementById('freq');
  var fmt = function(n){ return '$'+n.toLocaleString('en-US',{maximumFractionDigits:0}); };
  var fmt2 = function(n){ return '$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); };
  function params(){
    var f = FLAVORS[sel];
    var units = Math.round(f.min + (f.max-f.min)*(scale.value/100));
    var solves = Math.round(5 + 995*Math.pow(freq.value/100, 2));
    var hw = f.hwBase + f.hwPerUnit*units;
    var roy = f.royBase + f.royPerUnit*units;
    var monthly = solves*(hw+roy);   // por medicion, sin factor de victoria
    return {f:f, units:units, solves:solves, hw:hw, roy:roy, monthly:monthly};
  }
  function update(){
    var p = params();
    document.getElementById('scaleLabel').textContent = 'Problem size ('+p.f.unit+')';
    document.getElementById('scaleVal').textContent = p.units.toLocaleString('en-US');
    document.getElementById('freqVal').textContent = p.solves.toLocaleString('en-US')+' /mo';
    document.getElementById('eHw').textContent = fmt2(p.hw)+' /solve';
    document.getElementById('eRoy').textContent = fmt2(p.roy)+' /solve';
    document.getElementById('eMonth').textContent = fmt(p.monthly);
  }
  scale.addEventListener('input', update);
  freq.addEventListener('input', update);
  update();

  var running = false;
  document.getElementById('tasteBtn').addEventListener('click', function(){
    if (running) return;
    running = true;
    var p = params();
    var box = document.getElementById('sandbox');
    box.innerHTML = '';
    var adv = (5 + Math.random()*40).toFixed(1);
    var cost = fmt2(p.hw + p.roy);
    var lines = [
      ['ln-dim','$ qlib.solve("'+p.f.name.toLowerCase().replace(/ /g,'_')+'", sample_data, baseline=classical_v3)'],
      ['','formulating \u2192 '+p.units.toLocaleString()+' '+p.f.unit+' \u2192 Hamiltonian, 28 qubits'],
      ['','screening 1,204 circuit variants on GPU simulator\u2026'],
      ['','best candidate: '+p.f.id+'-v3 \u00b7 routing \u2192 trapped-ion (best price/queue)'],
      ['','executing 4,000 shots\u2026'],
      ['','comparing vs. classical baseline\u2026'],
      ['ln-ok','\u2713 ADVANTAGE (illustrative): '+adv+'\u00d7 \u00b7 how a win would read'],
      ['ln-gold','would bill: '+cost+' (hw '+fmt2(p.hw)+' + royalty '+fmt2(p.roy)+') \u00b7 sandbox: $0'],
      ['ln-dim','// preview \u00b7 simulator-backed \u00b7 real hardware routing at launch']
    ];
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var i = 0;
    function next(){
      if (i >= lines.length){ running = false; return; }
      var d = document.createElement('div');
      if (lines[i][0]) d.className = lines[i][0];
      d.textContent = lines[i][1];
      box.appendChild(d);
      i++;
      if (reduced) next(); else setTimeout(next, 420 + Math.random()*380);
    }
    next();
  });
})();