const {parseHTML}=require('linkedom');const path=require('path');
const d=require(path.resolve(__dirname,'../capture/home/dom.json'));
const {document}=parseHTML(d.html);
const root=document.querySelector('.root.container.responsivegrid');
let node=root; while(node&&node.children.length===1)node=node.children[0];
let main=[...node.children][1]; while(main&&main.children.length===1)main=main.children[0];
const secs=[...main.children];
[...secs[7].querySelectorAll('.cmp-text')].forEach(t=>console.log(t.innerHTML.replace(/>\s+</g,'>\n<').trim()+'\n---'));
