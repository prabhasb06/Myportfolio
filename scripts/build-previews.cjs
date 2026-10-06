// Keep static project metadata and readable HTML in sync with the preview data.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const script=fs.readFileSync(path.join(root,'coming-soon.js'),'utf8');
const data=vm.runInNewContext(script.slice(0,script.indexOf('const requestedProject'))+'\npreviews;');
const escape=value=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const template=fs.readFileSync(path.join(root,'coming-soon.html'),'utf8').replace(/coming-soon\.html\?project=(rag|slm|business)/g,(_,key)=>`preview-${key}.html`);
for(const [key,p] of Object.entries(data)) {
  let html=template.replace('<body>',`<body data-project="${key}">`);
  html=html.replace(/<title>.*?<\/title>/,`<title>${escape(p.name)} — In the Making | Prabhas Bangarugari</title>`);
  html=html.replace(/(<meta name="description" content=")[^"]*/,`$1${escape(p.lead)}`);
  html=html.replace(/(<meta property="og:title" content=")[^"]*/,`$1${escape(p.name)} — In the Making`);
  html=html.replace(/(<meta property="og:description" content=")[^"]*/,`$1${escape(p.lead)}`);
  for(const [id,value] of Object.entries({'project-index':p.index,'project-phase':p.phase,'project-name':p.name,'project-lead':p.lead,'project-state':p.state,'visual-code':p.code,'active-step-title':p.steps[0][0],'active-step-detail':p.steps[0][1]})) {
    html=html.replace(new RegExp(`(id="${id}">)[^<]*`),`$1${escape(value)}`);
  }
  html=html.replace(/(<h1 id="preview-title">)[\s\S]*?(<\/h1>)/,`$1${escape(p.title)}<br /><em>${escape(p.accent)}</em>$2`);
  html=html.replace('<div class="preview-console__phases" id="project-steps" aria-label="Explore project stages"></div>',`<div class="preview-console__phases" id="project-steps" aria-label="Explore project stages">${p.steps.map(([label,detail],i)=>`<details class="preview-static-stage"><summary>${String(i+1).padStart(2,'0')} / ${escape(label)}</summary><p>${escape(detail)}</p></details>`).join('')}</div>`);
  fs.writeFileSync(path.join(root,`preview-${key}.html`),html);
}
for(const name of ['index.html','coming-soon.html']) {
  const filename=path.join(root,name);
  fs.writeFileSync(filename,fs.readFileSync(filename,'utf8').replace(/coming-soon\.html\?project=(rag|slm|business)/g,(_,key)=>`preview-${key}.html`));
}
console.log('Updated three static previews and portfolio links.');
