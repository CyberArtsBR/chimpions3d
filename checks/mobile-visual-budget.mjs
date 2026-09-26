import assert from 'node:assert/strict';
import {allowsDesktopDetail,applyVisualDetailBudget} from '../src/mobileVisualBudget.js';

function node({desktopDetail=false,children=[]}={}){
  return {
    visible:true,
    userData:desktopDetail?{desktopDetail:true}:{},
    children,
    traverse(visitor){
      visitor(this);
      for(const child of this.children)child.traverse(visitor);
    }
  };
}

const accent=node({desktopDetail:true});
const nested=node({children:[node({desktopDetail:true})]});
const root=node({children:[accent,nested]});

assert.equal(allowsDesktopDetail('balanced',{constrained:false}),false,'Balanced must suppress desktop-only accents');
assert.equal(allowsDesktopDetail('high',{constrained:false}),true,'High desktop may show desktop-only accents');
assert.equal(allowsDesktopDetail('ultra',{constrained:false}),true,'Ultra desktop may show desktop-only accents');
assert.equal(allowsDesktopDetail('high',{constrained:true}),false,'Constrained High must suppress desktop-only accents');
assert.equal(allowsDesktopDetail('ultra',{constrained:true}),false,'Constrained Ultra must suppress desktop-only accents');

let result=applyVisualDetailBudget(root,{profile:'ultra'},{constrained:false});
assert.equal(result.allowDesktopDetail,true);
assert.equal(accent.visible,true);
assert.equal(nested.children[0].visible,true);

result=applyVisualDetailBudget(root,{profile:'ultra'},{constrained:true});
assert.equal(result.allowDesktopDetail,false);
assert.equal(accent.visible,false,'Mobile/constrained device must hide desktop detail');
assert.equal(nested.children[0].visible,false,'Mobile/constrained nested detail must stay hidden');

result=applyVisualDetailBudget(root,{profile:'balanced'},{constrained:false});
assert.equal(result.allowDesktopDetail,false);
assert.equal(accent.visible,false,'Balanced desktop must keep expensive accents hidden');

console.log('PASS explicit visual budget: Balanced and constrained/mobile profiles suppress desktopDetail without prototype mutation');
