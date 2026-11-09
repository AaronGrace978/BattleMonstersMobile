"""Build original smooth organic creature meshes, animate, export GLB, and render previews.
Run: blender -b --python scripts/models/build_creatures.py -- pyrax [--all]
Coordinates are Blender Z-up; heads face -Y. No billboard creature images are used.
"""
import bpy, math, random, sys, os, json
from mathutils import Vector
from mathutils.noise import noise_vector, noise
from pathlib import Path

BASE=Path(__file__).resolve().parents[2]
OUT=BASE/'work/models'; PREVIEW=BASE/'work/previews'
OUT.mkdir(parents=True,exist_ok=True); PREVIEW.mkdir(parents=True,exist_ok=True)
random.seed(17)
MATS={}; PARTS=[]; ROOT=None; JOINTS=[]; LAST_SCULPT=None

def color(hex):
    h=hex.lstrip('#'); return tuple(((int(h[i:i+2],16)/255+.055)/1.055)**2.4 if int(h[i:i+2],16)/255>.04045 else int(h[i:i+2],16)/255/12.92 for i in (0,2,4))

def material(name,hex,rough=.5,metal=.0,glow=0):
    if name in MATS:return MATS[name]
    m=bpy.data.materials.new(name);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');rgb=color(hex)
    p.inputs['Base Color'].default_value=(*rgb,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    p.inputs['Coat Weight'].default_value=.18;p.inputs['Coat Roughness'].default_value=.25
    if glow:p.inputs['Emission Color'].default_value=(*rgb,1);p.inputs['Emission Strength'].default_value=glow
    m.diffuse_color=(*rgb,1);MATS[name]=m;return m

def mat(name,hex,**kw):return material(name,hex,**kw)
def attach(obj,name,material=None,parent=None):
    obj.name=name
    if material:obj.data.materials.clear();obj.data.materials.append(material)
    if obj.type=='MESH':
        for p in obj.data.polygons:p.use_smooth=True
    obj.parent=parent or ROOT;PARTS.append(obj);return obj

def ell(name,pos,scale,material,rotation=None,parent=None,segments=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=16,location=pos)
    obj=bpy.context.object;obj.scale=scale
    if rotation:obj.rotation_euler=rotation
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return attach(obj,name,material,parent)

def mesh(name,verts,faces,material,parent=None):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj)
    return attach(obj,name,material,parent)

def curve(name,points,radii,material,sides=9,steps=5,parent=None):
    # Cardinal spline with parallel-transport frames: tapered horns, muscles, tails, roots.
    p=[Vector(v) for v in points];cs=[];rs=[]
    if isinstance(radii,(float,int)):radii=[radii]*len(p)
    for j in range(len(p)-1):
        a=p[max(0,j-1)];b=p[j];c=p[j+1];d=p[min(len(p)-1,j+2)]
        for k in range(steps):
            t=k/steps;t2=t*t;t3=t2*t
            cs.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t2+(-a+3*b-3*c+d)*t3))
            rs.append(radii[j]*(1-t)+radii[j+1]*t)
    cs.append(p[-1]);rs.append(max(.001,radii[-1]));verts=[];faces=[]
    prior=Vector((1,0,0))
    for i,center in enumerate(cs):
        tangent=(cs[min(i+1,len(cs)-1)]-cs[max(0,i-1)]).normalized()
        normal=(prior-tangent*prior.dot(tangent)).normalized()
        if normal.length<.1:normal=tangent.cross(Vector((0,0,1))).normalized()
        binormal=tangent.cross(normal).normalized();prior=normal
        for a in range(sides):
            theta=a/sides*math.tau
            v=center+rs[i]*(normal*math.cos(theta)+binormal*math.sin(theta));verts.append(tuple(v))
        if i:
            for a in range(sides):
                n=i*sides+a;prev=(i-1)*sides+a
                faces.append((prev,(i-1)*sides+(a+1)%sides,i*sides+(a+1)%sides,n))
    faces.append(tuple(reversed(range(sides))));faces.append(tuple((len(cs)-1)*sides+j for j in range(sides)))
    return mesh(name,verts,faces,material,parent)

def organic(name,objects,material,voxel=.065,roughness=.009):
    global LAST_SCULPT
    # Union anatomical volumes into ONE continuous, smoothed sculpted surface.
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();obj=objects[0]
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    rem=obj.modifiers.new('Continuous organic anatomy','REMESH');rem.mode='VOXEL';rem.voxel_size=voxel;rem.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=rem.name)
    sm=obj.modifiers.new('Sculpt polish','SMOOTH');sm.factor=.65;sm.iterations=5;bpy.ops.object.modifier_apply(modifier=sm.name)
    if roughness:
        for v in obj.data.vertices:
            point=obj.matrix_world@v.co
            v.co+=v.normal*(noise(point*12)-.5)*roughness
    obj.name=name;obj.data.materials.clear();obj.data.materials.append(material)
    for p in obj.data.polygons:p.use_smooth=True
    LAST_SCULPT=obj
    return obj

def joint(name,location):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=location;o.parent=ROOT;JOINTS.append(o);return o

def reparent(obj,parent):
    bpy.context.view_layer.update();world=obj.matrix_world.copy();obj.parent=parent;obj.matrix_world=world

def eye_pair(head_y,z,width,iris,black,white=None,size=.09,six=False):
    bpy.context.view_layer.update()
    def socket_at(position,eye_size):
        p=Vector(position);normal=Vector((0,-1,0))
        if LAST_SCULPT:
            found,local,n,index=LAST_SCULPT.closest_point_on_mesh(LAST_SCULPT.matrix_world.inverted()@p)
            if found:p=LAST_SCULPT.matrix_world@local;normal=(LAST_SCULPT.matrix_world.to_3x3()@n).normalized()
        rotation=Vector((0,-1,0)).rotation_difference(normal).to_euler()
        ell('Inset almond eye socket',p-normal*.004,(eye_size*1.2,eye_size*.28,eye_size*.83),black,rotation=rotation)
        ell('Living iris',p+normal*.009,(eye_size*.88,eye_size*.29,eye_size*.64),iris,rotation=rotation)
        ell('Vertical pupil',p+normal*(eye_size*.26+.011),(eye_size*.2,eye_size*.09,eye_size*.52),black,rotation=rotation,segments=16)
        if white:ell('Small wet catchlight',p+normal*(eye_size*.31+.015)+Vector((-eye_size*.2,0,eye_size*.23)),(eye_size*.12,eye_size*.08,eye_size*.12),white,rotation=rotation,segments=12)
        if LAST_SCULPT:
            side=(Vector((1,0,0))-normal*normal.x).normalized();up=normal.cross(side).normalized()
            curve('Sculpted upper eyelid',[tuple(p-side*eye_size*1.15),tuple(p+up*eye_size*.79+normal*.013),tuple(p+side*eye_size*1.15)],[eye_size*.12,eye_size*.23,eye_size*.1],LAST_SCULPT.data.materials[0],8,5)
    for s in [-1,1]:
        socket_at((s*width,head_y,z),size)
        if six:
            for i in (1,2):socket_at((s*(width+.025*i),head_y+.035*i,z+.12*i),size*.57)

def leaf(name,start,end,width,material,parent=None,curl=.04):
    start,end=Vector(start),Vector(end);axis=end-start;side=axis.cross(Vector((0,-1,.3))).normalized()
    if side.length<.1:side=Vector((1,0,0))
    verts=[];faces=[];long=10;across=4
    for i in range(long+1):
        t=i/long;w=width*math.sin(math.pi*t)**.8
        center=start+axis*t+Vector((0,0,math.sin(t*math.pi)*curl))
        for j in range(across+1):
            f=j/across*2-1;verts.append(tuple(center+side*w*f+Vector((0,0,(1-f*f)*width*.15*math.sin(math.pi*t)))))
    for i in range(long):
        for j in range(across):
            a=i*(across+1)+j;faces.append((a,a+1,a+across+2,a+across+1))
    obj=mesh(name,verts,faces,material,parent)
    return obj

def teeth(y,z,width,ivory,count=7):
    for i in range(count):
        x=(i/(count-1)*2-1)*width
        curve('Ivory fang',[(x,y+.05*abs(x),z),(x,y-.025,z-.08),(x,y-.04,z-.12)],[.029,.018,.001],ivory,7,3)

def claws(x,y,z,ivory,count=3,scale=1):
    for i in range(count):
        xx=x+(i-(count-1)/2)*.09*scale
        curve('Curved talon',[(xx,y,z),(xx,y-.14*scale,z-.015),(xx,y-.19*scale,z-.06)],[.035*scale,.024*scale,.001],ivory,7,3)

def antler(s,start,ivory,scale=1):
    x,y,z=start
    main=[(x,y,z),(x+s*.24*scale,y+.1*scale,z+.3*scale),(x+s*.4*scale,y+.26*scale,z+.7*scale),(x+s*.5*scale,y+.55*scale,z+1.05*scale)]
    curve('Antler crown',main,[.105*scale,.078*scale,.045*scale,.001],ivory,10,6)
    for i in range(1,4):
        p=main[min(i,3)];curve('Branching antler tine',[p,(p[0]+s*.25*scale,p[1]-.16*scale,p[2]+.22*scale),(p[0]+s*.34*scale,p[1]-.24*scale,p[2]+.46*scale)],[.06*scale,.035*scale,.001],ivory,8,5)

def fur_patch(center,scale,material,count=75,length=.18,seed=1,surface=None):
    rng=random.Random(seed)
    surface=surface or LAST_SCULPT;bpy.context.view_layer.update()
    for i in range(count):
        a=rng.random()*math.tau;u=rng.uniform(-.75,.95);r=math.sqrt(1-u*u)
        n=Vector((r*math.cos(a),r*math.sin(a),u));p=Vector(center)+Vector((n.x*scale[0],n.y*scale[1],n.z*scale[2]))
        if surface:
            found,local,normal,index=surface.closest_point_on_mesh(surface.matrix_world.inverted()@p)
            if found:p=surface.matrix_world@local;n=(surface.matrix_world.to_3x3()@normal).normalized()
        l=length*rng.uniform(.55,1.05);tip=p+n*l*.75+Vector((0,l*.45,-l*.12))
        curve('Sculpted tapered fur lock',[p-n*.008,p+n*l*.35,tip],[l*.15,l*.12,.001],material,7,3)

def scales(center,axes,material,rows=10,columns=18,skip_bottom=True):
    # Overlapping lenticular scales follow the surface, with real raised edges.
    cx,cy,cz=center;rx,ry,rz=axes
    for row in range(rows):
        phi=.15+(row/(rows-1))*(math.pi-.3)
        for col in range(columns):
            theta=(col+(row%2)*.5)/columns*math.tau
            if skip_bottom and math.cos(phi)<-.6:continue
            p=Vector((cx+rx*math.sin(phi)*math.cos(theta),cy+ry*math.sin(phi)*math.sin(theta),cz+rz*math.cos(phi)))
            n=Vector(((p.x-cx)/rx**2,(p.y-cy)/ry**2,(p.z-cz)/rz**2)).normalized()
            tangent=Vector((0,1,0));tangent=(tangent-n*tangent.dot(n)).normalized()
            side=n.cross(tangent).normalized();w=.065;length=.13
            verts=[tuple(p+n*.014),tuple(p+side*w),tuple(p+tangent*length),tuple(p-side*w),tuple(p-tangent*length*.7)]
            mesh('Raised overlapping scale',verts,[(0,1,2),(0,2,3),(0,3,4),(0,4,1)],material)

def quadruped(skin,kind='feline',size=1):
    parts=[]
    def volume(name,p,s):
        o=ell(name,tuple(v*size for v in p),tuple(v*size for v in s),skin);parts.append(o);return o
    deer=kind=='stag';h=.3 if deer else 0
    volume('Thorax',(0,0,1.2+h),(.37,.86,.42));volume('Shoulder muscle',(0,-.48,1.28+h),(.38,.37,.46));volume('Haunch',(0,.6,1.21+h),(.38,.36,.44))
    for side in (-1,1):
        x=.34*side
        for y in (-.5,.58):
            hind=y>0
            volume('Limb muscle',(x,y,.85+h*.7),(.12 if deer else .145,.18,.38+h*.4))
            volume('Articulated hock',(x,y+(.16 if hind else .02),.37+h*.3),(.067 if deer else .085,.085 if deer else .11,.32+h*.3))
            volume('Weight-bearing paw',(x,y-.1,.11),(.12 if deer else .15,.2,.12))
    if kind=='stag':
        volume('Rising neck',(0,-.67,2.25),(.19,.27,.75));volume('Stag skull',(0,-.85,2.94),(.2,.31,.25));volume('Tapered muzzle',(0,-1.1,2.77),(.145,.33,.14))
    else:
        volume('Powerful neck',(0,-.65,1.53),(.32,.37,.39));volume('Cranium',(0,-.87,1.82),(.31,.36,.32))
        volume('Muzzle',(0,-1.15,1.7),(.22,.32,.18));volume('Cheek left',(-.19,-.99,1.68),(.18,.2,.19));volume('Cheek right',(.19,-.99,1.68),(.18,.2,.19))
    return organic('Continuous sculpted anatomy',parts,skin,voxel=.048*size)

def dragon():
    skin=mat('Volcanic scales','#34363a',rough=.56,metal=.12);plates=mat('Obsidian armor','#25282e',rough=.43,metal=.32);edge=mat('Weathered horn','#b3a389',rough=.38);belly=mat('Warm belly plates','#88745b',rough=.58,metal=.12);fire=mat('Ember fissures','#f17b2c',rough=.3,glow=3);black=mat('Deep crevices','#120f10',rough=.3)
    flesh=[]
    for name,p,s in [('Ribcage',(0,.15,1.24),(.57,.96,.59)),('Shoulders',(0,-.45,1.5),(.65,.5,.64)),('Neck base',(0,-.63,1.94),(.33,.41,.64)),('Neck arch',(0,-.86,2.35),(.29,.38,.45)),('Dragon cranium',(0,-1.16,2.64),(.36,.43,.29)),('Long muzzle',(0,-1.53,2.54),(.28,.4,.17)),('Jaw muscle',(0,-1.27,2.4),(.3,.31,.17))]:flesh.append(ell(name,p,s,skin))
    for s in (-1,1):
        for y in (-.55,.72):
            x=s*(.47 if y<0 else .48)
            for name,p,sz in [('Deltoid',(x,y,1.16),(.26,.3,.43)),('Upper limb',(x+s*.08,y-.04,.79),(.2,.22,.36)),('Hock',(x+s*.1,y-.2,.41),(.13,.18,.32)),('Clawed foot',(x+s*.1,y-.36,.17),(.24,.33,.16))]:flesh.append(ell(name,p,sz,skin))
            claws(x+s*.1,y-.57,.2,edge,count=3,scale=1.2)
    organic('Pyrax sculpt',flesh,skin,voxel=.055,roughness=.02)
    tail=curve('Long tapered tail',[(0,.92,1.05),(0,1.5,.72),(.3,2.1,.46),(.9,2.52,.5),(1.5,2.5,.81),(1.8,2.12,.93)],[.34,.29,.22,.15,.08,.001],skin,14,9)
    tj=joint('Tail_Sway',(0,.9,1.0));reparent(tail,tj)
    for s in (-1,1):
        # Curving swept horns, cheek blades, expressive brows.
        curve('Great swept horn',[(s*.23,-.99,2.82),(s*.38,-.71,3.12),(s*.53,-.28,3.24),(s*.54,.1,3.37),(s*.44,.27,3.5)],[.135,.12,.085,.045,.001],edge,12,8)
        curve('Cheek horn',[(s*.28,-1.0,2.55),(s*.55,-.68,2.57),(s*.74,-.4,2.72)],[.1,.07,.001],plates,10,7)
        curve('Sculpted brow ridge',[(s*.12,-1.53,2.78),(s*.3,-1.39,2.84),(s*.4,-1.16,2.81)],[.08,.1,.04],plates,10,7)
        ell('Nostril',(s*.16,-1.86,2.58),(.055,.018,.03),black,segments=16)
        for j in range(4):curve('Neck armor ridge',[(s*.18,-.81+j*.06,2.5-j*.17),(s*.39,-.61+j*.05,2.57-j*.17),(s*.48,-.4+j*.04,2.55-j*.17)],[.08,.06,.001],plates,8,5)
    eye_pair(-1.47,2.76,.28,fire,black,size=.052)
    ell('Dark mouth',(0,-1.62,2.43),(.265,.32,.046),black);teeth(-1.79,2.47,.22,edge)
    for i in range(12):
        y=-.1+i*.19;z=1.8 if y<.9 else 1.8-(y-.9)*.6
        curve('Dorsal volcanic blade',[(0,y,z-.09),(0,y+.03,z+.25),(0,y+.17,z+.38)],[.13,.08,.001],plates,8,4)
        curve('Molten dorsal seam',[(.025,y,z),(.025,y+.02,z+.17),(.025,y+.13,z+.28)],[.018,.014,.001],fire,6,3)
    scales((0,.07,1.27),(.58,.94,.59),plates,12,22)
    scales((0,-.72,2.09),(.34,.42,.56),plates,9,16)
    for i in range(6):ell('Overlapping breast scute',(0,-1.08+i*.035,2.26-i*.18),(.2+i*.02,.075,.115),belly)
    for s in [-1,1]:
        for i in range(4):
            y=-.35+i*.29
            curve('Fine glowing volcanic fissure',[(s*.49,y,1.51),(s*.56,y+.07,1.35),(s*.55,y-.02,1.19),(s*.47,y+.11,1.03)],[.012,.015,.011,.001],fire,6,4)
    for s in (-1,1):
        j=joint('Wing_L' if s<0 else 'Wing_R',(s*.42,-.27,1.79));wingparts=[]
        shoulder=(s*.42,-.27,1.79);elbow=(s*1.21,-.03,2.52);tip=(s*2.58,.32,3.08)
        for points,r in [([shoulder,elbow,tip],[.16,.12,.025]),([elbow,(s*1.72,.9,2.17),(s*2.17,1.53,1.74)],[.085,.05,.001]),([elbow,(s*1.35,1.19,1.87),(s*1.46,1.8,1.4)],[.08,.045,.001]),([elbow,(s*.77,1.13,1.55),(s*.72,1.64,1.23)],[.075,.045,.001])]:wingparts.append(curve('Wing finger bones',points,r,skin,11,7))
        wingmat=mat('Warm translucent wing membrane','#8c4b35',rough=.6,metal=.05)
        # Curved membrane fans sag naturally between radial wing bones.
        ribs=[Vector(tip),Vector((s*2.17,1.53,1.74)),Vector((s*1.46,1.8,1.4)),Vector((s*.72,1.64,1.23)),Vector((s*.42,.65,1.35))];origin=Vector(elbow)
        for a in range(len(ribs)-1):
            verts=[];faces=[];n=12
            for u in range(n+1):
                t=u/n;end=ribs[a].lerp(ribs[a+1],t);end.z-=.24*math.sin(t*math.pi)
                for v in range(n+1):
                    f=v/n;p=origin.lerp(end,f);p.z-=math.sin(f*math.pi)*math.sin(t*math.pi)*.17;verts.append(tuple(p))
            for u in range(n):
                for v in range(n):
                    k=u*(n+1)+v;faces.append((k,k+1,k+n+2,k+n+1))
            obj=mesh('Sculpted wing membrane',verts,faces,wingmat);wingparts.append(obj)
            for vein in [.35,.66]:wingparts.append(curve('Wing membrane vein',[elbow,tuple(origin.lerp(ribs[a].lerp(ribs[a+1],vein),.5)-Vector((0,0,.1))),tuple(ribs[a].lerp(ribs[a+1],vein))],[.018,.012,.003],belly,6,5))
        for obj in wingparts:reparent(obj,j)

def fox():
    skin=mat('Moonlit ivory coat','#d7dce0',rough=.77);fur=mat('Silvery fur tips','#eef2ed',rough=.85);ice=mat('Carved glacier ice','#a2dbf0',rough=.18,metal=.25);eye=mat('Glacier eyes','#65b7f4',glow=2);dark=mat('Fox nose','#222c3c',rough=.32);white=mat('Eye sparkle','#fff4dc',glow=.3)
    quadruped(skin,'fox',.94)
    for s in [-1,1]:
        ear=curve('Tall fox ear',[(s*.23,-.72,1.81),(s*.31,-.68,2.05),(s*.38,-.68,2.3)],[.16,.12,.001],fur,12,7)
        leaf('Pale inner ear',(s*.23,-.81,1.9),(s*.37,-.73,2.26),.075,ice)
        antler(s,(s*.23,-.61,1.98),ice,.65)
    eye_pair(-1.12,1.78,.23,eye,dark,white,size=.067,six=True)
    ell('Wet fox nose',(0,-1.4,1.59),(.105,.065,.07),dark)
    tail=curve('Great flowing fox tail',[(0,.65,.97),(.24,1.02,.9),(.6,1.43,1.03),(.88,1.66,1.39),(.8,1.58,1.76),(.55,1.34,1.83)],[.18,.29,.36,.28,.14,.001],fur,14,10)
    j=joint('Tail_Sway',(0,.7,1));reparent(tail,j)
    fur_patch((0,-.37,1.29),(.48,.57,.53),fur,140,.16)
    fur_patch((.63,1.42,1.37),(.3,.34,.44),fur,120,.18,2,surface=tail)
    for s in [-1,1]:
        for y in [-.47,.54]:claws(s*.32,y-.25,.12,dark,3,.65)

def panther():
    skin=mat('Velvet panther pelt','#292b30',rough=.56);gold=mat('Stormforged gold','#c19a4e',rough=.3,metal=.8);black=mat('Panther nose','#141416',rough=.25);iris=mat('Lightning eyes','#ffd470',glow=2.5);ivory=mat('Panther fangs','#ddc59a',rough=.4)
    quadruped(skin,'feline',1.04)
    for s in [-1,1]:
        ell('Panther ear',(s*.26,-.71,2.1),(.13,.09,.19),skin)
        curve('Lightning horn',[(s*.25,-.75,2.02),(s*.41,-.5,2.28),(s*.48,-.55,2.52),(s*.65,-.28,2.8)],[.115,.09,.058,.001],gold,10,5)
        # Inlaid lightning wraps across the curved thorax rather than floating as rectangles.
        for i in range(4):
            y=-.38+i*.33
            curve('Golden lightning marking',[(s*.19,y,1.64),(s*.42,y+.07,1.5),(s*.47,y-.07,1.22),(s*.5,y+.16,1.05),(s*.39,y+.2,.91)],[.026,.035,.028,.022,.002],gold,7,4)
        curve('Face gold inlay',[(s*.12,-1.25,1.96),(s*.23,-1.13,2.03),(s*.29,-.94,2.12)],[.02,.025,.003],gold,7,6)
    eye_pair(-1.22,1.91,.235,iris,black,size=.072)
    ell('Panther nose',(0,-1.54,1.77),(.14,.07,.075),black)
    tail=curve('Panther whip tail',[(0,.75,1.2),(.3,1.27,1.3),(.53,1.7,1.56),(.7,1.92,1.96),(.55,1.85,2.25)],[.1,.09,.075,.05,.001],skin,12,9)
    j=joint('Tail_Sway',(0,.75,1.2));reparent(tail,j)
    for s in [-1,1]:
        curve('Saber fang',[(s*.17,-1.4,1.67),(s*.18,-1.43,1.52),(s*.16,-1.46,1.44)],[.04,.03,.001],ivory,8,5)
        for y in [-.52,.62]:claws(s*.35,y-.3,.15,ivory,3,.8)

def stag():
    skin=mat('Ancient chestnut hide','#82634b',rough=.75);bark=mat('Living bark antlers','#6c5440',rough=.8);ivory=mat('Bone hoof','#37332c',rough=.65);moss=mat('Crown leaves','#7d914d',rough=.75);leaflight=mat('Young leaves','#afaa64',rough=.7);iris=mat('Forest eyes','#c5d29c',glow=1.4);dark=mat('Stag nose','#27221d',rough=.4)
    quadruped(skin,'stag',1.12)
    for s in [-1,1]:
        antler(s,(s*.17,-.67,3.46),bark,1.0)
        leaf('Sculpted deer ear',(s*.19,-.88,3.3),(s*.7,-.73,3.49),.14,skin,curl=.1)
        for i in range(24):
            rng=random.Random(i+17*(s+2));t=rng.uniform(.1,.95);x=s*(.17+.5*t);y=-.67+.55*t;z=3.46+1.05*t
            leaf('Antler foliage',(x,y,z),(x+s*.13,y-.12,z+.12),.055,moss if i%2 else leaflight)
        for j in range(10):
            y=-.15+j*.13;curve('Bark fur grain',[(s*.27,y,2.1),(s*.43,y+.07,1.85),(s*.4,y+.1,1.55)],[.012,.018,.001],bark,6,4)
        for y in [-.56,.65]:ell('Cloven hoof',(s*.38,y-.1,.11),(.17,.24,.1),ivory)
    eye_pair(-1.23,3.32,.21,iris,dark,size=.045)
    ell('Stag nose',(0,-1.58,3.07),(.11,.06,.06),dark)
    tail=curve('Deer tail',[(0,.94,1.28),(0,1.18,1.22),(0,1.29,1.06)],[.12,.1,.001],skin,10,6)
    for i in range(35):
        rng=random.Random(150+i);x=rng.uniform(-.34,.34);y=rng.uniform(-.5,.6);z=1.93+math.sqrt(max(0,1-(x/.42)**2))*.23
        leaf('Shoulder moss leaf',(x,y,z),(x+.07,y-.08,z+.13),.065,moss,curl=.03)

def serpent():
    skin=mat('Deep sapphire scales','#294f73',rough=.31,metal=.3);plate=mat('Serpent iridescence','#608eaa',rough=.3,metal=.48);fin=mat('Tidal fins','#4583a4',rough=.47,metal=.15);belly=mat('Pearl underbelly','#b2b8ab',rough=.38,metal=.2);glow=mat('Bioluminescent markings','#99d5de',glow=2);dark=mat('Ocean depths','#101e2a',rough=.25)
    points=[(.9,.8,.3),(1.15,.05,.35),(.65,-.55,.36),(-.35,-.55,.4),(-.95,.0,.53),(-.63,.7,.73),(.05,.63,1.04),(.35,.19,1.42),(.2,-.28,1.9),(0,-.6,2.29),(0,-.96,2.49)]
    curve('Continuous coiled serpent body',points,[.025,.2,.29,.35,.37,.36,.32,.29,.27,.24,.22],skin,20,10)
    flesh=[]
    for name,p,s in [('Serpent skull',(0,-1.1,2.5),(.31,.38,.25)),('Reptilian muzzle',(0,-1.43,2.42),(.25,.35,.14)),('Lower jaw',(0,-1.35,2.27),(.23,.33,.11))]:flesh.append(ell(name,p,s,skin))
    organic('Abyssal head sculpt',flesh,skin,.04)
    eye_pair(-1.42,2.58,.25,glow,dark,size=.075)
    for s in [-1,1]:
        for j in range(4):leaf('Crown fin',[(s*.18),-.93+j*.13,2.64-j*.05],(s*(.49+j*.08),-.61+j*.16,3.01-j*.07),.15,fin,curl=.12)
        curve('Tidal whisker',[(s*.22,-1.49,2.35),(s*.47,-1.67,2.24),(s*.65,-1.55,2.07)],[.025,.018,.001],belly,7,8)
    for i,p in enumerate(points[2:-1]):
        x,y,z=p
        for s in [-1,1]:
            leaf('Flowing dorsal sail',(x+s*.17,y,z+.2),(x+s*.6,y+.15,z+.55),.18,fin,curl=.1)
            ell('Bioluminescent pearl',(x+s*.28,y-.05,z+.1),(.038,.035,.04),glow,segments=12)
    scales((0,-1.06,2.5),(.32,.4,.26),plate,7,16)
    for i in range(9):
        z=1.02+i*.15;y=.52-i*.13;ell('Pearlescent belly scale',(0,y-.21,z),(.17,.06,.11),belly,segments=16)

def golem():
    stone=mat('Worn volcanic stone','#5b5556',rough=.87);ridges=mat('Weathered stone ridges','#82756a',rough=.8);crystal=mat('Amethyst heart','#b893d6',rough=.24,metal=.35,glow=1.5);deep=mat('Deep stone fissures','#27242b',rough=.6)
    flesh=[]
    for name,p,s in [('Massive chest',(0,0,1.63),(.77,.45,.75)),('Tapered waist',(0,.05,.99),(.48,.32,.45)),('Stone head',(0,-.08,2.48),(.4,.35,.43)),('Brow block softened',(0,-.34,2.56),(.41,.17,.14))]:flesh.append(ell(name,p,s,stone))
    for s in [-1,1]:
        for name,p,sz in [('Mountain shoulder',(s*.72,.0,1.99),(.4,.4,.43)),('Massive upper arm',(s*.97,-.03,1.55),(.31,.35,.48)),('Stone forearm',(s*1.08,-.2,1.05),(.34,.4,.45)),('Knuckled fist',(s*1.13,-.37,.7),(.35,.4,.3)),('Thigh',(s*.38,.05,.65),(.3,.34,.48)),('Weight-bearing shin',(s*.41,-.03,.3),(.26,.3,.3)),('Wide foot',(s*.42,-.19,.12),(.32,.42,.14))]:flesh.append(ell(name,p,sz,stone))
    organic('Continuous mountain guardian sculpt',flesh,stone,.065,.055)
    for s in [-1,1]:
        for i in range(5):
            x=s*(.35+i*.16);z=2.1+math.sin(i/4*math.pi)*.35
            curve('Eroded shoulder ridgeline',[(x,-.25,z-.25),(x,-.12,z+.06),(x+s*.16,.06,z+.32)],[.15,.12,.005],ridges,9,5)
        for i in range(4):curve('Organic forearm ridge',[(s*.88,-.45,1.44-i*.13),(s*1.22,-.48,1.36-i*.13),(s*1.37,-.22,1.26-i*.13)],[.06,.09,.005],ridges,8,5)
        for i in range(3):curve('Stone finger articulation',[(s*(1.01+i*.1),-.64,.78),(s*(1.02+i*.1),-.7,.63),(s*(1.04+i*.1),-.62,.5)],[.065,.07,.04],stone,9,5)
        curve('Living chest crevice',[(s*.12,-.45,1.65),(s*.32,-.45,1.87),(s*.52,-.33,1.98)],[.024,.018,.002],crystal,7,5)
    eye_pair(-.383,2.56,.175,crystal,deep,size=.07)
    ell('Amethyst heart socket',(0,-.431,1.65),(.24,.1,.28),deep)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=(0,-.47,1.65));o=bpy.context.object;o.scale=(.17,.13,.24);attach(o,'Sculpted amethyst heart',crystal)
    for j in range(5):curve('Ancient forehead engraving',[(0,-.37,2.91-j*.045),(.09,-.405,2.86-j*.045),(.0,-.42,2.81-j*.045)],[.014,.011,.003],ridges,6,3)

def feather(name,start,end,width,body,tip,parent=None):
    start=Vector(start);end=Vector(end);axis=end-start;cross=axis.cross(Vector((0,-1,.2))).normalized()
    if cross.length<.1:cross=Vector((1,0,0))
    verts=[];faces=[];n=14
    for i in range(n+1):
        t=i/n;center=start+axis*t+Vector((0,.08*math.sin(t*math.pi),.06*math.sin(t*math.pi)))
        w=width*math.sin(math.pi*t)**.55
        for f in [-1,0,1]:verts.append(tuple(center+cross*w*f+Vector((0,-(1-abs(f))*.035,0))))
        if i:
            k=i*3;faces.extend([(k-3,k-2,k+1,k),(k-2,k-1,k+2,k+1)])
    obj=mesh(name,verts,faces,body,parent);obj.data.materials.append(tip)
    for face in obj.data.polygons:
        if face.center.length>0:pass
        if face.index>len(obj.data.polygons)*.75:face.material_index=1
    return obj

def feather_wing(s,rootpos,body,tip,span=2.1,kind='gryphon'):
    j=joint('Wing_L' if s<0 else 'Wing_R',rootpos);parts=[];x,y,z=rootpos
    parts.append(curve('Feathered wing arm',[(x,y,z),(s*.95,y+.1,z+.48),(s*1.55,y+.3,z+.72)],[.22,.16,.07],body,12,8))
    for row in range(3):
        for i in range(13):
            t=i/12;start=(x+s*(.1+t*1.12),y+.12+row*.09,z+.1+t*.6-row*.1)
            end=(s*(.83+t*(span-.68)),y+.67+row*.18+(1-t)*.1,z-.35+t*.48-row*.18)
            parts.append(feather('Layered flight feather',start,end,.10+row*.018,body,tip))
    for o in parts:reparent(o,j)

def gryphon():
    ivory=mat('Ivory flight feathers','#e2dfce',rough=.62);teal=mat('Sky feather tips','#78b7be',rough=.4,metal=.15);gold=mat('Gryphon beak','#b29a62',rough=.38,metal=.3);pelt=mat('Lion hide','#a2957c',rough=.75);dark=mat('Gryphon pupil','#22282b',rough=.28);eye=mat('Celestial eye','#9ed5dd',glow=1.4)
    parts=[]
    for name,p,s in [('Lion torso',(0,.25,1.09),(.45,.78,.47)),('Feathered breast',(0,-.34,1.42),(.42,.4,.6)),('Eagle head',(0,-.65,1.99),(.29,.32,.31))]:parts.append(ell(name,p,s,ivory if 'Lion' not in name else pelt))
    organic('Sculpted gryphon anatomy',parts,ivory,.05)
    for s in [-1,1]:
        for y in [-.35,.65]:
            curve('Gryphon leg',[(s*.32,y,1.0),(s*.38,y+.06,.55),(s*.38,y-.06,.14)],[.16,.11,.07],pelt if y>0 else gold,11,8)
            claws(s*.38,y-.09,.13,gold,3,1.2)
        feather_wing(s,(s*.32,-.15,1.51),ivory,teal,2.05)
        curve('Regal feather brow',[(s*.1,-.88,2.09),(s*.26,-.72,2.18),(s*.43,-.42,2.31)],[.08,.1,.001],ivory,10,7)
    curve('Hooked eagle beak',[(0,-.88,1.98),(0,-1.14,1.92),(0,-1.22,1.72)],[.14,.12,.001],gold,13,8)
    eye_pair(-.88,2.08,.23,eye,dark,size=.067)
    for i in range(7):feather('Crest feather',(0,-.41,2.14),(math.sin(i)*.17,-.12+i*.04,2.58-abs(i-3)*.045),.075,ivory,teal)
    for row in range(4):
        for i in range(8):
            a=i/8*math.tau;x=.36*math.cos(a);y=-.35+.28*math.sin(a);z=1.75-row*.14
            feather('Breast contour feather',(x,y,z),(x*1.05,y-.02,z-.32),.085,ivory,teal)
    tail=curve('Lion tail',[(0,.85,1.2),(.15,1.35,1.1),(.4,1.67,1.22),(.6,1.63,1.48)],[.1,.08,.05,.001],pelt,10,9)
    j=joint('Tail_Sway',(0,.85,1.2));reparent(tail,j)

def wolf():
    skin=mat('Midnight wolf pelt','#393442',rough=.7);fur=mat('Twilight guard fur','#51445f',rough=.8);horn=mat('Polished dark horn','#55505d',rough=.3,metal=.25);eye=mat('Warden violet eyes','#c0a0dc',glow=2.4);black=mat('Wolf nose','#17151e',rough=.3)
    quadruped(skin,'wolf',1.08)
    for s in [-1,1]:
        curve('Wolf ear',[(s*.22,-.79,2.05),(s*.32,-.71,2.29),(s*.4,-.66,2.46)],[.16,.13,.001],skin,12,8)
        curve('Curled warden horn',[(s*.21,-.67,2.12),(s*.46,-.43,2.37),(s*.57,-.15,2.7),(s*.43,-.01,2.88),(s*.24,-.14,2.85)],[.14,.12,.085,.05,.001],horn,12,10)
    eye_pair(-1.27,1.99,.25,eye,black,size=.075)
    ell('Wet wolf nose',(0,-1.62,1.84),(.11,.07,.075),black)
    fur_patch((0,-.45,1.55),(.52,.49,.55),fur,185,.22,8)
    tail=curve('Long wolf tail',[(0,.8,1.24),(.13,1.35,1.13),(.35,1.73,.94),(.65,1.99,.88),(.88,2.09,1.13)],[.2,.25,.24,.16,.001],skin,14,10)
    j=joint('Tail_Sway',(0,.8,1.24));reparent(tail,j)
    fur_patch((.38,1.66,1.0),(.29,.48,.28),fur,90,.17,9,surface=tail)
    for s in [-1,1]:
        for y in [-.54,.63]:claws(s*.36,y-.29,.14,horn,3,.9)

def phoenix():
    gold=mat('Sunlit gold feathers','#c7a568',rough=.36,metal=.42);ivory=mat('Warm ivory feathers','#eee4c4',rough=.46,metal=.12);ember=mat('Ember feather tips','#ba6f3c',rough=.4,metal=.25);beak=mat('Phoenix beak','#6c543c',rough=.3,metal=.4);eye=mat('Daybreak eyes','#f9d6a5',glow=2.2);black=mat('Phoenix eye socket','#382b24',rough=.3)
    parts=[]
    for name,p,s in [('Phoenix breast',(0,0,1.4),(.4,.48,.63)),('Rising bird neck',(0,-.32,1.96),(.19,.24,.45)),('Phoenix head',(0,-.5,2.29),(.25,.27,.27))]:parts.append(ell(name,p,s,ivory))
    organic('Phoenix sculpt',parts,ivory,.045)
    for s in [-1,1]:
        feather_wing(s,(s*.29,-.06,1.64),gold,ember,2.35,'phoenix')
        curve('Phoenix slender leg',[(s*.16,.0,1.01),(s*.19,-.08,.56),(s*.2,-.2,.22)],[.07,.055,.035],beak,10,8)
        claws(s*.2,-.21,.16,gold,3,1.2)
    curve('Curved phoenix beak',[(0,-.7,2.27),(0,-.96,2.2),(0,-1.01,2.05)],[.115,.09,.001],beak,12,8)
    eye_pair(-.7,2.4,.19,eye,black,size=.065)
    for i in range(9):
        x=(i-4)*.055
        feather('Crown of dawn',(x,-.36,2.44),(x*2,.03+abs(i-4)*.04,3.02-abs(i-4)*.08),.065,gold,ember)
    for i in range(13):
        t=(i-6)/6
        points=[(t*.15,.3,1.34),(t*.37,.85,1.16),(t*.7,1.5,.8),(t*1.0,2.12,.56+abs(t)*.35),(t*.9,2.6,1.0+abs(t)*.22)]
        curve('Flowing phoenix tail ribbon',points,[.07,.1,.1,.07,.001],gold if i%2 else ember,8,9)
    for row in range(5):
        for i in range(10):
            a=i/10*math.tau;x=.34*math.cos(a);y=.38*math.sin(a);z=1.79-row*.16
            feather('Phoenix breast feather',(x,y,z),(x*1.1,y*1.08,z-.29),.08,ivory,gold)

def mushroom_cap(center,radius,height,cap,gill,spots,seed=1):
    x,y,z=center;segments=64;rings=16;verts=[];faces=[]
    for ring in range(rings+1):
        t=max(.001,ring/rings);r=radius*math.sin(t*math.pi/2)
        for i in range(segments):
            a=i/segments*math.tau;rr=r*(1+.035*math.sin(a*5)+.015*math.sin(a*9))
            zz=z+height*math.cos(t*math.pi/2)+.025*math.sin(a*5)*t
            verts.append((x+math.cos(a)*rr,y+math.sin(a)*rr,zz))
            if ring:
                k=ring*segments+i;faces.append((k,(ring)*segments+(i+1)%segments,(ring-1)*segments+(i+1)%segments,k-segments))
    obj=mesh('Undulating mushroom crown',verts,faces,cap)
    # Thin radial gills are actual curved geometry on the underside.
    for i in range(48):
        a=i/48*math.tau;curve('Radial mushroom gill',[(x+math.cos(a)*radius*.15,y+math.sin(a)*radius*.15,z-.1),(x+math.cos(a)*radius*.55,y+math.sin(a)*radius*.55,z-.055),(x+math.cos(a)*radius*.96,y+math.sin(a)*radius*.96,z)],[.008,.012,.004],gill,5,4)
    rng=random.Random(seed)
    for i in range(max(6,int(radius*28))):
        a=rng.random()*math.tau;t=rng.uniform(.1,.9);r=radius*math.sin(t*math.pi/2);zz=z+height*math.cos(t*math.pi/2)
        ell('Organic ivory cap spot',(x+r*math.cos(a),y+r*math.sin(a),zz+.009),(.035+radius*.025,.04+radius*.025,.008),spots,segments=12)

def mycelis():
    skin=mat('Soft woodland fur','#a59b7e',rough=.9);moss=mat('Forest moss mantle','#76765a',rough=.86);cap=mat('Aubergine mushroom cap','#805968',rough=.48);gills=mat('Rose mushroom gills','#bd9295',rough=.66);ivory=mat('Ivory cap freckles','#dbcab1',rough=.68);iris=mat('Amber woodland eyes','#e0ad67',rough=.22,glow=.35);black=mat('Bright dark pupils','#262022',rough=.18)
    parts=[]
    for name,p,s in [('Round woodland body',(0,0,.8),(.59,.45,.65)),('Sweet creature face',(0,-.36,1.17),(.43,.3,.36)),('Left foot',(-.34,-.12,.15),(.24,.3,.19)),('Right foot',(.34,-.12,.15),(.24,.3,.19)),('Left curved arm',(-.55,-.05,.65),(.2,.22,.35)),('Right curved arm',(.55,-.05,.65),(.2,.22,.35))]:parts.append(ell(name,p,s,skin))
    organic('Soft forest creature sculpt',parts,skin,.045)
    eye_pair(-.615,1.25,.2,iris,black,ivory,size=.105)
    ell('Small velvet nose',(0,-.681,1.12),(.07,.033,.05),black)
    curve('Gentle creature smile',[(-.12,-.64,1.04),(0,-.67,.99),(.12,-.64,1.04)],[.012,.014,.012],black,6,8)
    mushroom_cap((0,.0,1.53),.79,.35,cap,gills,ivory,20)
    for i,(x,y,z,r) in enumerate([(-.48,.3,1.25,.29),(.43,.34,1.27,.32),(-.25,.47,.9,.23),(.32,.51,.83,.21)]):
        curve('Mushroom stalk',[(x,y,z-.3),(x,y,z-.1),(x,y,z)],[r*.18,r*.15,r*.16],ivory,9,6)
        mushroom_cap((x,y,z),r,r*.5,cap,gills,ivory,30+i)
    fur_patch((0,-.05,.84),(.6,.48,.54),moss,120,.13,25)

BUILDERS={'pyrax':dragon,'glaciel':fox,'voltra':panther,'sylvara':stag,'abyssal':serpent,'obsidian':golem,'zephyr':gryphon,'noctis':wolf,'solaris':phoenix,'mycelis':mycelis}

def animate():
    # Exported named glTF transform animations: idle, attack, summon.
    scene=bpy.context.scene;scene.render.fps=30
    ROOT.animation_data_create()
    for name,length in [('Idle',120),('Attack',24),('Summon',48)]:
        action=bpy.data.actions.new(name);ROOT.animation_data.action=action
        for f in range(0,length+1,6):
            t=f/length
            if name=='Idle':ROOT.location=(0,0,math.sin(t*math.tau)*.027);ROOT.scale=(1,1,1+math.sin(t*math.tau)*.008)
            elif name=='Attack':ROOT.location=(0,-math.sin(t*math.pi)**2*.55,math.sin(t*math.pi)*.08);ROOT.scale=(1,1,1)
            else:
                q=min(1,t*3);ease=1-(1-q)**3;ROOT.location=(0,0,(1-ease)*.35);ROOT.scale=(max(.001,ease),)*3
            ROOT.keyframe_insert(data_path='location',frame=f);ROOT.keyframe_insert(data_path='scale',frame=f)
        track=ROOT.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,0,action);strip.action_frame_end=length;ROOT.animation_data.action=None
    for j in JOINTS:
        j.animation_data_create();action=bpy.data.actions.new(j.name+'_Idle');j.animation_data.action=action
        for f in range(0,121,15):
            t=f/120
            if j.name.startswith('Wing'):
                side=-1 if j.name.endswith('L') else 1;j.rotation_euler=(.025*math.sin(t*math.tau),side*.055*math.sin(t*math.tau),0)
            else:j.rotation_euler=(0,0,.07*math.sin(t*math.tau))
            j.keyframe_insert(data_path='rotation_euler',frame=f)
        track=j.animation_data.nla_tracks.new();track.name='Idle';track.strips.new('Idle',0,action);j.animation_data.action=None
    scene.frame_set(120)

def consolidate():
    # Merge static detail meshes by material AND animation parent to cut draw calls.
    buckets={}
    for obj in list(bpy.context.scene.objects):
        if obj.type=='MESH':buckets.setdefault((obj.parent.name if obj.parent else '',tuple(m.name for m in obj.data.materials)),[]).append(obj)
    for key,objects in buckets.items():
        if len(objects)<2:continue
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:obj.select_set(True)
        bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();objects[0].name=f'{key[0]}_{key[1][0] if key[1] else "sculpt"}'
    # Bake double-sided feather/membrane materials for correct WebGL visibility.
    for m in bpy.data.materials:m.use_backface_culling=False

def bounds():
    verts=[obj.matrix_world@Vector(corner) for obj in bpy.context.scene.objects if obj.type=='MESH' for corner in obj.bound_box]
    minimum=Vector(tuple(min(v[i] for v in verts) for i in range(3)));maximum=Vector(tuple(max(v[i] for v in verts) for i in range(3)))
    return minimum,maximum

def preview(name):
    low,high=bounds();center=(low+high)*.5;size=max(high-low)
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=False
    scene.render.resolution_x=700;scene.render.resolution_y=700;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.filepath=str(PREVIEW/f'{name}.png')
    scene.world.color=(.13,.115,.10)
    world=scene.world;world.use_nodes=True;world.node_tree.nodes.get('Background').inputs[0].default_value=(.12,.105,.09,1);world.node_tree.nodes.get('Background').inputs[1].default_value=.55
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.045));floor=bpy.context.object;floor.data.materials.append(mat('Preview charcoal stone','#262221',rough=.83))
    def light(p,power,hex,size=5):
        data=bpy.data.lights.new('Studio softbox','AREA');data.energy=power;data.color=color(hex);data.shape='DISK';data.size=size;obj=bpy.data.objects.new('Studio softbox',data);bpy.context.collection.objects.link(obj);obj.location=p;obj.rotation_euler=(center-obj.location).to_track_quat('-Z','Y').to_euler()
    light((3,-4,6),1300,'#ffe5b9',5);light((-4,-1,3.8),1000,'#c6d4e4',4);light((1,4,5),1700,'#ffd19b',3)
    data=bpy.data.cameras.new('Preview camera');camera=bpy.data.objects.new('Preview camera',data);bpy.context.collection.objects.link(camera)
    camera.location=center+Vector((.9,-1.6,.72)).normalized()*size*2.15;camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler();data.type='ORTHO';data.ortho_scale=size*1.23;scene.camera=camera
    scene.view_settings.view_transform='AgX';scene.render.film_transparent=False
    bpy.ops.render.render(write_still=True)

def build(name):
    global ROOT,MATS,PARTS,JOINTS
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    for block in list(bpy.data.materials):bpy.data.materials.remove(block)
    MATS={};PARTS=[];JOINTS=[];random.seed(17)
    ROOT=bpy.data.objects.new(name.title()+'_Character',None);bpy.context.collection.objects.link(ROOT)
    BUILDERS[name]();bpy.context.view_layer.update();consolidate();animate();bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='SELECT')
    path=OUT/f'{name}.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_nla_strips=True,export_force_sampling=True,export_frame_range=False,export_materials='EXPORT',export_yup=True,export_apply=True,export_extras=True)
    tris=sum(len(o.data.polygons)*2 for o in bpy.context.scene.objects if o.type=='MESH')
    print(f'CREATURE_EXPORTED {name} {path.stat().st_size} bytes ~{tris} triangles',flush=True)
    preview(name)

args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['pyrax']
names=list(BUILDERS) if '--all' in args else [a for a in args if a in BUILDERS]
for name in names:build(name)
print('CREATURE_BUILD_COMPLETE',flush=True)
