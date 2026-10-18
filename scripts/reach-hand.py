"""The AUVOX hand, v3: the libigl tutorial hand (a real, anatomical hand), rigged from its TGF
skeleton, posed like Michelangelo's reaching hand, given a forearm, and exported in the site's frame
(wrist at the origin, fingers +X, back of the hand +Z, a left hand).

    Blender -b --factory-startup -P hand3.py -- hand_surf.obj hand.tgf out.glb [preview-prefix]
"""
import math, sys
import bmesh, bpy
from mathutils import Matrix, Vector

args = sys.argv[sys.argv.index("--") + 1:]
SRC, TGF, OUT = args[0], args[1], args[2]
PREVIEW = args[3] if len(args) > 3 else None

# ---- the skeleton
V, E, mode = {}, [], 0
for l in open(TGF).read().split("\n"):
    if not l.strip(): continue
    if l.strip().startswith("#"): mode += 1; continue
    p = l.split()
    if mode == 0: V[int(p[0])] = Vector(tuple(map(float, p[1:4])))
    else: E.append((int(p[0]), int(p[1])))
CHAINS = {"index": [2, 6, 7, 8, 9], "middle": [2, 10, 11, 12, 13], "ring": [2, 14, 15, 16, 17], "pinky": [2, 18, 19, 20, 21], "thumb": [2, 3, 4, 5]}
WRIST, PALM = V[1], V[2]
F = Vector((0, 1, 0))      # fingers
N = Vector((0, 0, 1))      # the palm faces +Z (the thumb and the fingers' natural curl both go that way)

# bends at (MCP, PIP, DIP) in degrees, curling toward the palm; spread at the MCP about the palm normal
# (+ toward the thumb). The thumb: (CMC, MCP, IP) bends and an inward fold.
POSES = {
    "rest": {"index": ((6, 10, 6), 5), "middle": ((12, 20, 12), 1), "ring": ((20, 28, 16), -4), "pinky": ((26, 34, 18), -9), "thumb": ((10, 12, 8), 18)},
    "reach": {"index": ((-2, 2, 2), 4), "middle": ((8, 14, 8), 1), "ring": ((14, 20, 12), -3), "pinky": ((18, 26, 14), -7), "thumb": ((6, 8, 6), 12)},
}
SUBDIV = 1
SPREAD_SIGN = -1.0  # + spreads toward the thumb (checked in the previews)
FOREARM_SEGMENTS = 16
FOREARM_LENGTH = 2.55   # model units (the hand is ~1.5 from wrist to fingertip)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=SRC, forward_axis='Y', up_axis='Z')
hand = [o for o in bpy.context.scene.objects if o.type == "MESH"][0]
hand.name = "handmesh"

# ---- open the wrist (the tet surface is capped) and grow a forearm from the opening
bm = bmesh.new(); bm.from_mesh(hand.data)
bm.faces.ensure_lookup_table()
ymin = min(v.co.y for v in bm.verts)
cap = [f for f in bm.faces if f.normal.y < -0.55 and all(v.co.y < ymin + 0.12 for v in f.verts)]
print("cap faces", len(cap))
bmesh.ops.delete(bm, geom=cap, context="FACES")
boundary = [e for e in bm.edges if e.is_boundary]
print("boundary edges", len(boundary))
# walk the loop in order
adj = {}
for e in boundary:
    a, b = e.verts
    adj.setdefault(a, []).append(b); adj.setdefault(b, []).append(a)
start = boundary[0].verts[0]
ring = [start]; prev = None
while True:
    cur = ring[-1]
    nxt = next((x for x in adj[cur] if x is not prev), None)
    if nxt is None or nxt is start: break
    ring.append(nxt); prev = cur
print("ring verts", len(ring))
ringset = set(ring)
others = [e for e in boundary if not (e.verts[0] in ringset and e.verts[1] in ringset)]
if others:
    bmesh.ops.holes_fill(bm, edges=others, sides=0)
boundary = [e for e in boundary if e.verts[0] in ringset and e.verts[1] in ringset]
print("ring edges", len(boundary), "other boundary edges filled", len(others))
c0 = sum((v.co for v in ring), Vector()) / len(ring)
U = F.cross(N).normalized()  # across the wrist
def flat(v):
    r = v.co - c0
    return r - F * r.dot(F)
# arc-length angles round the opening
lengths = [0.0]
for i in range(1, len(ring) + 1):
    lengths.append(lengths[-1] + (flat(ring[i % len(ring)]) - flat(ring[i - 1])).length)
total = lengths[-1]
r0 = flat(ring[0]); phi0 = math.atan2(r0.dot(N), r0.dot(U))
r1 = flat(ring[len(ring) // 4]); turn = 1.0 if math.sin(math.atan2(r1.dot(N), r1.dot(U)) - phi0) > 0 else -1.0
polar = {v: (phi0 + turn * 2 * math.pi * lengths[i] / total, flat(v).dot(U), flat(v).dot(N)) for i, v in enumerate(ring)}
A = max(abs(p[1]) for p in polar.values()); B = max(abs(p[2]) for p in polar.values())
print(f"wrist opening {A:.3f} x {B:.3f}")
origin = {v: v for v in ring}
edges = boundary
step = FOREARM_LENGTH / FOREARM_SEGMENTS
for i in range(1, FOREARM_SEGMENTS + 1):
    t = i / FOREARM_SEGMENTS
    ret = bmesh.ops.extrude_edge_only(bm, edges=edges)
    fresh = [g for g in ret["geom"] if isinstance(g, bmesh.types.BMVert)]
    fset = set(fresh)
    edges = [g for g in ret["geom"] if isinstance(g, bmesh.types.BMEdge) and all(v in fset for v in g.verts)]
    new = []
    for v in fresh:
        src = next(e.other_vert(v) for e in v.link_edges if e.other_vert(v) in origin and e.other_vert(v) not in fset)
        origin[v] = origin[src]; new.append((v, origin[src]))
    c = c0 - F * step * i
    # the forearm continues the wrist at its own size, then widens gently toward the elbow;
    # a little flatter front-to-back than side-to-side
    grow = 1 + 0.28 * t ** 1.4
    deep = 0.92 + 0.12 * min(1.0, t * 1.5)
    w = min(1.0, i / 2.0)
    for v, o in new:
        phi, ru, rn = polar[o]
        eu, en = math.cos(phi) * A * 0.98, math.sin(phi) * B * 0.98
        ou, on = ru * (1 - w) + eu * w, rn * (1 - w) + en * w
        v.co = c + U * ou * grow + N * on * grow * deep
bmesh.ops.holes_fill(bm, edges=edges, sides=0)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(hand.data); bm.free()
for p in hand.data.polygons: p.use_smooth = True
hand.data.update()

# ---- the armature, from the skeleton
arm_data = bpy.data.armatures.new("arm"); arm = bpy.data.objects.new("arm", arm_data)
bpy.context.scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
bones = {}
def add_bone(name, head, tail, parent=None):
    b = arm_data.edit_bones.new(name); b.head = head; b.tail = tail
    if parent is not None: b.parent = arm_data.edit_bones[parent]
    return name
add_bone("wrist", WRIST, PALM)
# the forearm bone, so those vertices bind to something rigid
add_bone("forearm", WRIST - F * FOREARM_LENGTH, WRIST, None)
arm_data.edit_bones["wrist"].parent = arm_data.edit_bones["forearm"]
for finger, chain in CHAINS.items():
    parent = "wrist"
    for i in range(len(chain) - 1):
        name = f"{finger}-{i}"
        add_bone(name, V[chain[i]], V[chain[i + 1]], parent)
        parent = name
bpy.ops.object.mode_set(mode="OBJECT")
rest_local = {b.name: b.matrix_local.copy() for b in arm_data.bones}

# ---- bind with automatic weights
for o in bpy.context.scene.objects: o.select_set(False)
hand.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type="ARMATURE_AUTO")
print("bound; groups", len(hand.vertex_groups))
sub = hand.modifiers.new("subdiv", "SUBSURF"); sub.levels = sub.render_levels = SUBDIV

# ---- pose by forward kinematics
def set_pose(spec):
    for pb in arm.pose.bones: pb.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    tips = {}
    for finger, chain in CHAINS.items():
        bends, spread = spec[finger]
        T = Matrix.Identity(4)
        for i in range(len(chain) - 1):
            name = f"{finger}-{i}"
            h = V[chain[i]]
            if i == 0:
                # the palm bone itself does not bend; the spread (and the thumb's fold) happen at its end
                arm.pose.bones[name].matrix = T @ rest_local[name]; bpy.context.view_layer.update(); continue
            d = (V[chain[i + 1]] - h).normalized()
            axis = d.cross(N).normalized()          # curls toward the palm
            M = Matrix.Rotation(math.radians(bends[i - 1]), 4, axis)
            if i == 1 and spread:
                M = Matrix.Rotation(math.radians(spread) * SPREAD_SIGN, 4, N) @ M
            T = T @ Matrix.Translation(h) @ M @ Matrix.Translation(-h)
            arm.pose.bones[name].matrix = T @ rest_local[name]
            bpy.context.view_layer.update()
        tips[finger] = T @ V[chain[-1]]
    return tips

# model -> site: fingers +Y -> +X, palm +Z -> -Z (back +Z), thumb -X -> -Y; wrist to the origin; scaled
HAND_LEN = (V[13] - WRIST).length
SCALE = 0.182 / HAND_LEN
CANON = Matrix.Scale(SCALE, 4) @ Matrix(((0, 1, 0, 0), (1, 0, 0, 0), (0, 0, -1, 0), (0, 0, 0, 1))) @ Matrix.Translation(-WRIST)
print("det", CANON.to_3x3().determinant(), "scale", SCALE)

def bake(spec):
    tips = set_pose(spec)
    dg = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(hand.evaluated_get(dg))
    mesh.transform(CANON @ hand.matrix_world)
    return mesh, CANON @ tips["index"]

raw = [CANON @ hand.matrix_world @ v.co for v in hand.data.vertices]
print(f"raw mesh x-range {min(v.x for v in raw):.3f}..{max(v.x for v in raw):.3f}  y {min(v.y for v in raw):.3f}..{max(v.y for v in raw):.3f}  z {min(v.z for v in raw):.3f}..{max(v.z for v in raw):.3f}")
unweighted = sum(1 for v in hand.data.vertices if not v.groups)
print("unweighted verts", unweighted, "of", len(hand.data.vertices))
rest_mesh, rest_tip = bake(POSES["rest"])
reach_mesh, reach_tip = bake(POSES["reach"])
assert len(rest_mesh.vertices) == len(reach_mesh.vertices)
out = bpy.data.objects.new("hand", rest_mesh); bpy.context.scene.collection.objects.link(out)
while rest_mesh.uv_layers: rest_mesh.uv_layers.remove(rest_mesh.uv_layers[0])
out.shape_key_add(name="Basis"); key = out.shape_key_add(name="reach")
for i, v in enumerate(reach_mesh.vertices): key.data[i].co = v.co
for name, p in (("tip", rest_tip), ("tipReach", reach_tip)):
    e = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(e); e.location = p; e.parent = out
xs = [v.co.x for v in rest_mesh.vertices]
print(f"verts {len(rest_mesh.vertices)} x-range {min(xs):.3f}..{max(xs):.3f} tip {tuple(round(x,4) for x in rest_tip)} tipReach {tuple(round(x,4) for x in reach_tip)}")

if PREVIEW:
    scene = bpy.context.scene
    hand.hide_render = True; arm.hide_render = True
    for p in rest_mesh.polygons: p.use_smooth = True
    mat = bpy.data.materials.new("lacquer"); mat.use_nodes = True
    b = mat.node_tree.nodes["Principled BSDF"]; b.inputs["Base Color"].default_value = (0.5, 0.05, 0.05, 1); b.inputs["Roughness"].default_value = 0.35; b.inputs["Coat Weight"].default_value = 0.6
    rest_mesh.materials.append(mat)
    scene.render.engine = "BLENDER_EEVEE"; scene.render.resolution_x = 1000; scene.render.resolution_y = 700
    world = bpy.data.worlds.new("w"); scene.world = world; world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.98, 0.9, 0.78, 1); world.node_tree.nodes["Background"].inputs[1].default_value = 1.0
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sun.data.energy = 5; sun.rotation_euler = (math.radians(35), math.radians(-30), math.radians(20)); scene.collection.objects.link(sun)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); scene.collection.objects.link(cam); scene.camera = cam
    # the site's view: camera on +Z looking down -Z, fingers to the right
    for i, (loc, rot, morph) in enumerate([((0, 0, 0.9), (0, 0, 0), 0.0), ((0, -0.9, 0), (math.radians(90), 0, 0), 0.0), ((0, 0, 0.9), (0, 0, 0), 1.0)]):
        key.value = morph
        cam.location = loc; cam.rotation_euler = rot
        scene.render.filepath = f"{PREVIEW}-{i}.png"; bpy.ops.render.render(write_still=True)
    key.value = 0

bpy.data.objects.remove(hand, do_unlink=True); bpy.data.objects.remove(arm, do_unlink=True)
for o in bpy.data.objects: o.select_set(o.name in ("hand", "tip", "tipReach"))
bpy.context.view_layer.objects.active = out
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True, export_apply=False, export_texcoords=False, export_normals=True, export_materials="NONE", export_morph=True, export_morph_normal=True, export_yup=True)
print("wrote", OUT)
