"""Generate ATROX's original mathematical project covers (no remote assets)."""
from math import sin,cos,pi,exp
from pathlib import Path
out=Path(__file__).resolve().parents[1]/'public'/'art'
def path(pts):return ' '.join(('M' if i==0 else 'L')+f'{x:.2f},{y:.2f}' for i,(x,y) in enumerate(pts))
def line(pts,color,opacity=.6,w=.8):return f'<path d="{path(pts)}" fill="none" stroke="{color}" stroke-width="{w}" opacity="{opacity}"/>'
def wrap(name,base,lit,accent,body):
 svg=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 184" fill="none"><defs><radialGradient id="bg" cx="60%" cy="60%" r="80%"><stop stop-color="{lit}"/><stop offset="1" stop-color="{base}"/></radialGradient><pattern id="grid" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0V22" stroke="{accent}" opacity=".11" stroke-width=".65"/></pattern><linearGradient id="side"><stop stop-color="{lit}"/><stop offset="1" stop-color="{base}"/></linearGradient></defs><path fill="url(#bg)" d="M0 0h480v184H0z"/><path fill="url(#grid)" d="M0 0h480v184H0z"/>'''
 for x,y in [(36,44),(58,132),(410,44),(432,132),(102,154),(366,110)]:svg+=line([(x-3,y),(x+3,y)],accent,.4)+line([(x,y-3),(x,y+3)],accent,.4)
 svg+=body+'<g fill="'+accent+'" opacity=".54"><rect x="18" y="161" width="14" height="2"/><rect x="35" y="161" width="4" height="2"/><rect x="42" y="161" width="2" height="2"/></g></svg>'
 (out/(name+'.svg')).write_text(svg)
# Lit wireframe torus, painter-sorted quads retain occlusion and depth.
def torus(u,v):
 x=(66+26*cos(v))*cos(u); y=(66+26*cos(v))*sin(u);z=26*sin(v);a=.90;b=-.36
 sy=y*cos(a)-z*sin(a);depth=y*sin(a)+z*cos(a);return (250+1.27*(x*cos(b)-sy*sin(b)),94+.97*(x*sin(b)+sy*cos(b)),depth)
quads=[]
for i in range(72):
 for j in range(25):
  pts=[torus(2*pi*(i+a)/72,2*pi*(j+b)/25) for a,b in [(0,0),(1,0),(1,1),(0,1)]];depth=sum(p[2] for p in pts)/4;brightness=.46+.48*(depth+92)/184;c=f'rgb({int(172*brightness)},{int(121*brightness)},{int(247*brightness)})';fill=f'rgb({int(35*brightness+8)},{int(19*brightness+6)},{int(63*brightness+12)})';quads.append((depth,f'<path d="{path([p[:2] for p in pts])}Z" stroke="{c}" stroke-width=".72" fill="{fill}"/>'))
wrap('crm','#151021','#302141','#AD86EA',''.join(s for _,s in sorted(quads)))
# Exploded blueprint of an offset three-layer storage volume.
body='';c='#75D5E5';
def proj(x,y,z):return (252+x*.99-y*.99,123+x*.39+y*.39-z)
for n in range(3):
 z=n*23;ox=n*3;oy=-n*2;size=50;corners=[(-size,-size),(size,-size),(size,size),(-size,size)];top=[proj(x+ox,y+oy,z+12) for x,y in corners];bottom=[proj(x+ox,y+oy,z)for x,y in corners]
 for i in [0,1,2,3]:
  j=(i+1)%4;body+=f'<path d="{path([top[i],top[j],bottom[j],bottom[i]])}Z" fill="url(#side)" stroke="{c}" stroke-width="1.1"/>'
 body+=f'<path d="{path(top)}Z" fill="#123742" stroke="{c}" stroke-width="1.1"/>'
 for v in range(-45,50,6):
  body+=line([proj(v+ox,-size+oy,z+12),proj(v+ox,size+oy,z+12)],c,.38,.6)+line([proj(-size+ox,v+oy,z+12),proj(size+ox,v+oy,z+12)],c,.38,.6)
 for v in [3,6,9]:body+=line([proj(size+ox,-size+oy,z+v),proj(size+ox,size+oy,z+v),proj(-size+ox,size+oy,z+v)],c,.48,.6)
wrap('inventory','#0c1a22','#13343b',c,body)
body='';col='#EEAF68';
def mesh(x,y):
 h=6+40*exp(-((x+18)**2/2300+(y-6)**2/480))* (1+.42*sin(x*.045+y*.05))+33*exp(-((x-60)**2/1100+(y+6)**2/460));return (246+x*1.05-y*.64,110+y*.53+x*.13-h+5*sin(x*.05))
for yi in range(-36,39,3):
 points=[mesh(x,yi) for x in range(-115,116,3)];nextrow=[mesh(x,yi+3) for x in range(-115,116,3)];body+=f'<path d="{path(points+nextrow[::-1])}Z" fill="#352217"/>'+line(points,col,.9,.85)
 for k in range(0,len(points),2):body+=line([points[k],nextrow[k]],col,.38,.6)
wrap('analytics','#201711','#3c291a',col,body)
