"""The AUVOX hand for the Promise section: the WebXR generic hand, posed and given a forearm.

    Blender -b --factory-startup -P scripts/promise-hand.py -- <left.glb>  public/promise/guide.glb   guide   [preview-prefix]
    Blender -b --factory-startup -P scripts/promise-hand.py -- <right.glb> public/promise/student.glb student [preview-prefix]

(the sources are dist/profiles/generic-hand/{left,right}.glb from @webxr-input-profiles/assets 1.0.20)

Source: the "generic-hand" model from @webxr-input-profiles/assets (MIT, (c) 2019 Amazon) — a smooth
hand with a 25-joint skin. Its joints are a flat list (no hierarchy), so the pose is done by hand
here: forward kinematics down each finger, every joint bending the ones after it.

Writes one static mesh (subdivided, no UVs, no material — the site gives it the lacquer) with a
morph target "reach" (the index finger straightens and the hand opens a little) and two empties,
"tip" and "tipReach", where the index fingertip is in each pose.

Frame of the exported model (three.js, y up): the wrist is at the origin, the fingers point +X and
the back of the hand faces +Z, so with no rotation the camera sees the back of the hand.
"""
import math
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

args = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT, ROLE = args[0], args[1], args[2]
PREVIEW = args[3] if len(args) > 3 else None

FINGERS = {
    name: [f"{name}-finger-metacarpal", f"{name}-finger-phalanx-proximal", f"{name}-finger-phalanx-intermediate", f"{name}-finger-phalanx-distal", f"{name}-finger-tip"]
    for name in ("index", "middle", "ring", "pinky")
}
FINGERS["thumb"] = ["thumb-metacarpal", "thumb-phalanx-proximal", "thumb-phalanx-distal", "thumb-tip"]

# Bend at each joint after the metacarpal, degrees (positive curls toward the palm), plus a spread
# at the knuckle (for the thumb: a fold toward the index, at its base).
# "guide" is the AUVOX hand — Michelangelo's: sure, the index reaching, the others falling away in turn.
# "student" is softer and more hesitant: everything a little more curled, the index only half out,
# and on "reach" it opens toward the guide.
GUIDE = {
    "rest": {
        "index": ((6, 9, 6), 3),
        "middle": ((18, 28, 16), 0),
        "ring": ((26, 36, 20), -4),
        "pinky": ((32, 42, 22), -8),
        "thumb": ((10, 14), 20),
    },
    "reach": {
        "index": ((-2, 1, 1), 2),
        "middle": ((10, 16, 9), 0),
        "ring": ((15, 22, 12), -3),
        "pinky": ((19, 27, 14), -6),
        "thumb": ((5, 8), 14),
    },
}
STUDENT = {
    "rest": {
        "index": ((16, 24, 12), 3),
        "middle": ((26, 38, 20), 0),
        "ring": ((32, 44, 24), -4),
        "pinky": ((36, 48, 26), -8),
        "thumb": ((12, 18), 24),
    },
    "reach": {
        "index": ((2, 6, 4), 2),
        "middle": ((12, 20, 12), 0),
        "ring": ((17, 26, 15), -3),
        "pinky": ((22, 30, 17), -6),
        "thumb": ((6, 10), 16),
    },
}
POSES = GUIDE if ROLE == "guide" else STUDENT

FOREARM_SEGMENTS = 14
FOREARM_LENGTH = 3.2  # times the wrist→middle-knuckle distance (the far end disappears into cloud)
SUBDIV = 1

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
hand = next(o for o in bpy.data.objects if o.type == "MESH" and "hand" in o.name.lower())
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
for o in list(bpy.data.objects):
    if o not in (hand, arm):
        bpy.data.objects.remove(o, do_unlink=True)

bones = arm.data.bones
head = {b.name: b.head_local.copy() for b in bones}  # armature space

# ---- the hand's own frame (armature space)
wrist = head["wrist"]
f = (head["middle-finger-phalanx-proximal"] - wrist).normalized()
across = (head["index-finger-phalanx-proximal"] - head["pinky-finger-phalanx-proximal"]).normalized()
n = f.cross(across).normalized()
curl = sum((head[c[4]] - head[c[1]] for k, c in FINGERS.items() if k != "thumb"), Vector())
if n.dot(curl) > 0:  # the fingers curl toward the palm, so the back of the hand faces away from that
    n = -n
s = f.cross(n)
# signs that make "fold the thumb in" and "fan the fingers out" mean the same on either hand
thumb_side = (head["thumb-phalanx-proximal"] - wrist).dot(s)
THUMB_IN = 1.0 if thumb_side > 0 else -1.0
SPREAD = -1.0 if across.dot(s) > 0 else 1.0
src = Matrix((f, n, s)).transposed()  # columns f, n, s
dst = Matrix(((1, 0, 0), (0, -1, 0), (0, 0, -1))).transposed()  # three.js +X, +Z, -Y in Blender axes
ROT = (dst @ src.transposed()).to_4x4()
CANON = ROT @ Matrix.Translation(-wrist)
knuckle = (head["middle-finger-phalanx-proximal"] - wrist).length
print(f"frame: f={tuple(round(x, 3) for x in f)} n={tuple(round(x, 3) for x in n)} knuckle={knuckle:.4f}")

# ---- merge the UV seams, then grow a forearm out of the wrist opening
to_mesh = hand.matrix_world.inverted() @ arm.matrix_world
mesh_f = (to_mesh.to_3x3() @ f).normalized()
mesh_n = (to_mesh.to_3x3() @ n).normalized()
mesh_wrist = to_mesh @ wrist
# the import brings custom split normals; extruded rings would copy them (long grooves down the arm)
bpy.context.view_layer.objects.active = hand
hand.select_set(True)
try:
    bpy.ops.mesh.customdata_custom_splitnormals_clear()
except RuntimeError as e:
    print("custom normals:", e)
for name in ("custom_normal",):
    if name in hand.data.attributes:
        hand.data.attributes.remove(hand.data.attributes[name])
bm = bmesh.new()
bm.from_mesh(hand.data)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
# the wrist is closed by a flat cap facing the elbow: take it off so the forearm can grow from its rim
bm.normal_update()
# cut the wrist off square, a little in from its end: one clean, planar, round opening
end = min(v.co.dot(mesh_f) for v in bm.verts)
cut_co = mesh_f * (end + knuckle * 0.16) + (mesh_wrist - mesh_f * mesh_wrist.dot(mesh_f))
bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-6, plane_co=cut_co, plane_no=mesh_f, clear_inner=True)
boundary = [e for e in bm.edges if e.is_boundary]
loops, seen = [], set()
for e in boundary:
    if e in seen:
        continue
    group, todo = [], [e]
    while todo:
        x = todo.pop()
        if x in seen:
            continue
        seen.add(x)
        group.append(x)
        for v in x.verts:
            todo.extend(y for y in v.link_edges if y.is_boundary and y not in seen)
    loops.append(group)
centre = lambda es: sum((v.co for v in {v for e in es for v in e.verts}), Vector()) / len({v for e in es for v in e.verts})
loop = min(loops, key=lambda es: (centre(es) - mesh_wrist).length)
print(f"boundary loops: {len(loops)}, wrist loop: {len(loop)} edges")

step = knuckle * FOREARM_LENGTH / FOREARM_SEGMENTS
c0 = centre(loop)
u_axis = mesh_f.cross(mesh_n).normalized()
# the wrist opening, as an angle and a radius per vertex around its centre
# walk the opening in order, then give each vertex an angle by arc length, so the angles only ever
# increase round the loop (the opening is lumpy: their raw angles double back, and on a clean ellipse
# that folds the surface into long grooves)
bm.verts.index_update()
bm.verts.ensure_lookup_table()
adj = {}
for e in loop:
    a, b = e.verts[0].index, e.verts[1].index
    adj.setdefault(a, []).append(b)
    adj.setdefault(b, []).append(a)
order = [loop[0].verts[0].index]
prev = -1
while len(order) <= len(adj):
    cur = order[-1]
    nxt = next(x for x in adj[cur] if x != prev)
    if nxt == order[0]:
        break
    order.append(nxt)
    prev = cur
ring = [bm.verts[i] for i in order]
print("loop degrees", sorted(set(len(v) for v in adj.values())), "verts", len(adj))
def flat(v):
    r = v.co - c0
    r -= mesh_f * r.dot(mesh_f)
    return r
lengths = [0.0]
for i in range(1, len(ring) + 1):
    lengths.append(lengths[-1] + (flat(ring[i % len(ring)]) - flat(ring[i - 1])).length)
total = lengths[-1]
r0 = flat(ring[0])
phi0 = math.atan2(r0.dot(mesh_n), r0.dot(u_axis))
r1 = flat(ring[len(ring) // 4])
turn = 1.0 if math.sin(math.atan2(r1.dot(mesh_n), r1.dot(u_axis)) - phi0) > 0 else -1.0
polar = {}
for i, v in enumerate(ring):
    r = flat(v)
    polar[v.index] = (phi0 + turn * 2 * math.pi * lengths[i] / total, r.dot(u_axis), r.dot(mesh_n))
print(f"wrist ring: {len(ring)} verts in order")
A = max(abs(p[1]) for p in polar.values())
B = max(abs(p[2]) for p in polar.values())
print(f"wrist opening: {A:.4f} x {B:.4f}")
# every ring follows its wrist vertex round; after the first two rings the section is a clean ellipse
# (the wrist opening is lumpy, and copying it down the arm left long grooves)
polar = {v: polar[v.index] for v in ring}  # keyed by vertex from here on (indices change as we extrude)
origin = {v: v for v in ring}  # vertex -> the wrist vertex it descends from
edges = loop
for i in range(1, FOREARM_SEGMENTS + 1):
    t = i / FOREARM_SEGMENTS
    ret = bmesh.ops.extrude_edge_only(bm, edges=edges)
    fresh = [g for g in ret["geom"] if isinstance(g, bmesh.types.BMVert)]
    fresh_set = set(fresh)
    edges = [g for g in ret["geom"] if isinstance(g, bmesh.types.BMEdge) and all(v in fresh_set for v in g.verts)]
    # each new vertex was extruded from one on the previous ring: carry its wrist vertex along
    new_verts = []
    for v in fresh:
        src = next(e.other_vert(v) for e in v.link_edges if e.other_vert(v) in origin and e.other_vert(v) not in fresh_set)
        origin[v] = origin[src]
        new_verts.append((v, origin[src]))
    c = c0 - mesh_f * step * i
    grow = 1 + 0.38 * t**1.2  # the forearm widens toward the elbow
    deep = 1 + 0.3 * min(1.0, t * 2.2)  # and gets rounder, front to back, soon after the wrist
    w = min(1.0, i / 2.0)
    for v, o in new_verts:
        phi, ru, rn = polar[o]
        eu, en = math.cos(phi) * A * 0.98, math.sin(phi) * B * 0.98
        ou, on = ru * (1 - w) + eu * w, rn * (1 - w) + en * w
        v.co = c + u_axis * ou * grow + mesh_n * on * grow * deep
bmesh.ops.holes_fill(bm, edges=edges, sides=0)
bm.to_mesh(hand.data)
bm.free()
for p in hand.data.polygons:
    p.use_smooth = True
sub = hand.modifiers.new("subdiv", "SUBSURF")
sub.levels = sub.render_levels = SUBDIV

# ---- pose by forward kinematics and bake each pose
def set_pose(spec):
    for pb in arm.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    tips = {}
    for finger, chain in FINGERS.items():
        bends, spread = spec[finger]
        T = Matrix.Identity(4)
        for i, name in enumerate(chain):
            h = head[name]
            if finger == "thumb" and i == 0 and spread:
                # fold the whole thumb in, about the axis through its base along the back-of-hand normal
                M = Matrix.Rotation(math.radians(spread) * THUMB_IN, 4, n)
                T = T @ Matrix.Translation(h) @ M @ Matrix.Translation(-h)
            if 1 <= i <= len(bends):
                d = (head[chain[i + 1]] - h).normalized()
                axis = n.cross(d).normalized()
                M = Matrix.Rotation(math.radians(bends[i - 1]), 4, axis)
                if i == 1 and spread and finger != "thumb":
                    M = Matrix.Rotation(math.radians(spread) * SPREAD, 4, n) @ M
                T = T @ Matrix.Translation(h) @ M @ Matrix.Translation(-h)
            arm.pose.bones[name].matrix = T @ bones[name].matrix_local
            tips[name] = T @ head[name]
    bpy.context.view_layer.update()
    return tips


def bake(spec):
    tips = set_pose(spec)
    dg = bpy.context.evaluated_depsgraph_get()
    ev = hand.evaluated_get(dg)
    mesh = bpy.data.meshes.new_from_object(ev)
    to_canon = CANON @ arm.matrix_world.inverted() @ hand.matrix_world
    mesh.transform(to_canon)
    return mesh, CANON @ tips["index-finger-tip"]


rest_mesh, rest_tip = bake(POSES["rest"])
reach_mesh, reach_tip = bake(POSES["reach"])
assert len(rest_mesh.vertices) == len(reach_mesh.vertices)

out = bpy.data.objects.new("hand", rest_mesh)
bpy.context.scene.collection.objects.link(out)
while rest_mesh.uv_layers:
    rest_mesh.uv_layers.remove(rest_mesh.uv_layers[0])
out.shape_key_add(name="Basis")
key = out.shape_key_add(name="reach")
for i, v in enumerate(reach_mesh.vertices):
    key.data[i].co = v.co
for name, p in (("tip", rest_tip), ("tipReach", reach_tip)):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = p
    e.parent = out
print(f"verts {len(rest_mesh.vertices)}  tip {tuple(round(x, 4) for x in rest_tip)}  tipReach {tuple(round(x, 4) for x in reach_tip)}")

bpy.data.objects.remove(hand, do_unlink=True)
bpy.data.objects.remove(arm, do_unlink=True)
for o in bpy.data.objects:
    o.select_set(o.name in ("hand", "tip", "tipReach"))
bpy.context.view_layer.objects.active = out
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    use_selection=True,
    export_apply=False,
    export_texcoords=False,
    export_normals=True,
    export_materials="NONE",
    export_morph=True,
    export_morph_normal=True,
    export_skins=False,
    export_animations=False,
)
print("wrote", OUT)

if PREVIEW:
    # the back of the hand, fingers to the right, both poses side by side (rest, reach)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "SINGLE"
    scene.display.shading.single_color = (0.55, 0.05, 0.04)
    scene.display.shading.show_specular_highlight = True
    scene.render.resolution_x, scene.render.resolution_y = 1200, 700
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = knuckle * 6.2
    target = Vector((-knuckle * 0.4, 0, 0))
    for label, loc in (("back", Vector((0, -1, 0.35))), ("side", Vector((0, -0.25, 1)))):
        cam.location = target + loc.normalized() * 2
        cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
        for k, val in (("rest", 0.0), ("reach", 1.0)):
            key.value = val
            scene.render.filepath = f"{PREVIEW}_{label}_{k}.png"
            bpy.ops.render.render(write_still=True)
