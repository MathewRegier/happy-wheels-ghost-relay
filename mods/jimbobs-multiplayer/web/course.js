(function (root) {
  'use strict';
  const MARK = '#jmp';
  const CATALOG = 'JHWMP';
  const REACH = 220;
  const RIDERS = [
    {id: 1, names: ['wheelchair guy', 'wheelchair', 'chair']},
    {id: 2, names: ['segway guy', 'segway']},
    {id: 3, names: ['irresponsible dad', 'dad']},
    {id: 4, names: ['effective shopper', 'shopper']},
    {id: 5, names: ['moped couple', 'moped']},
    {id: 6, names: ['lawnmower man', 'lawnmower', 'lawn']},
    {id: 7, names: ['explorer guy', 'explorer']},
    {id: 8, names: ['santa claus', 'santa']},
    {id: 9, names: ['pogostick man', 'pogostick', 'pogo']},
    {id: 10, names: ['irresponsible mom', 'mom']},
    {id: 11, names: ['helicopter man', 'helicopter', 'heli']},
  ];
  const KEYS = ['level', '_level', 'shapeGuide', 'special', 'texts', 'textBoxes', 'textFields', 'specials', 'items', 'shapes', 'levelObjects', 'gameObjects', 'triggers', 'groups', 'contents', 'children', 'foreground', 'background', 'spriteDictionary', 'groupDictionary', 'specialDictionary', '_sprite', 'sprite'];

  function firstLine(text) {
    return String(text || '').split(/\r?\n/)[0].trim();
  }

  function namedForCatalog(title) {
    return /\bJHWMP\b/i.test(String(title || ''));
  }

  function parseDuration(raw) {
    const value = String(raw || '').trim().toLowerCase();
    if (!value) return null;
    const clock = value.match(/^(\d{1,2}):(\d{2})$/);
    if (clock) return (Number(clock[1]) * 60 + Number(clock[2])) * 1000;
    const mixed = value.match(/^(\d+)\s*m(?:in(?:ute)?s?)?\s*(\d+)\s*s(?:ec(?:ond)?s?)?$/);
    if (mixed) return (Number(mixed[1]) * 60 + Number(mixed[2])) * 1000;
    const minutes = value.match(/^(\d+)\s*m(?:in(?:ute)?s?)?$/);
    if (minutes) return Number(minutes[1]) * 60 * 1000;
    const seconds = value.match(/^(\d+)\s*s(?:ec(?:ond)?s?)?$/);
    if (seconds) return Number(seconds[1]) * 1000;
    if (/^\d+$/.test(value)) return Number(value) * 1000;
    return null;
  }

  function parseRider(raw) {
    const value = String(raw || '').trim().toLowerCase();
    if (/^[1-9]$|^1[01]$/.test(value)) return Number(value);
    const hit = RIDERS.find((entry) => entry.names.some((name) => value === name || value.includes(name) || name.includes(value)));
    return hit ? hit.id : null;
  }

  function riderName(id) {
    return RIDERS.find((entry) => entry.id === id)?.names[0] || '';
  }

  function parseOnOff(raw) {
    const value = String(raw || '').trim().toLowerCase();
    if (['on', 'yes', 'true', '1'].includes(value)) return true;
    if (['off', 'no', 'false', '0'].includes(value)) return false;
    return null;
  }

  function empty() {
    return {
      starts: [],
      flags: [],
      goal: null,
      camera: null,
      loops: null,
      bump: null,
      rider: null,
      clockMs: null,
      lingerMs: null,
      retry: null,
      waitSec: null,
      seats: null,
      play: null,
      ordered: false,
      warnings: [],
      boxes: [],
    };
  }

  function parseTag(text) {
    const line = firstLine(text);
    const match = line.match(/^#jmp(?:\s+|$)(.*)$/i);
    if (!match) return null;
    const rest = String(match[1] || '').trim();
    if (!rest) return {error: 'Empty #jmp tag.'};
    const parts = rest.split(/\s+/);
    const verb = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ');
    if (verb === 'start') {
      const start = arg.match(/^(\d+)(?:\s+(left|right))?$/i);
      if(arg&&!start)return {error:'Use #jmp start 1, or #jmp start 1 left/right.'};
      const n = start ? Number(start[1]) : null;
      if (arg && (!Number.isInteger(n) || n < 1 || n > 16)) return {error: 'Start numbers must be 1 to 16.'};
      return {kind: 'start', n: Number.isInteger(n) ? n : null, ...(start?.[2]?{facing:start[2].toLowerCase()}: {})};
    }
    if (verb === 'flag') {
      const n = arg ? Number(arg) : null;
      if (arg && (!Number.isInteger(n) || n < 1 || n > 32)) return {error: 'Flag numbers must be 1 to 32.'};
      return {kind: 'flag', n: Number.isInteger(n) ? n : null};
    }
    if (verb === 'goal') return {kind: 'goal'};
    if (verb === 'loops') {
      const n = Number(arg);
      if (!Number.isInteger(n) || n < 1 || n > 20) return {error: 'Loops must be 1 to 20.'};
      return {kind: 'loops', n};
    }
    if (verb === 'bump') {
      const on = parseOnOff(arg);
      if (on == null) return {error: 'Use #jmp bump on or #jmp bump off.'};
      return {kind: 'bump', on};
    }
    if (verb === 'rider') {
      const id = parseRider(arg);
      if (!id) return {error: 'Unknown rider "' + arg + '".'};
      return {kind: 'rider', id};
    }
    if (verb === 'clock') {
      const ms = parseDuration(arg);
      if (ms == null || ms < 10000 || ms > 3600000) return {error: 'Clock must be between 10 seconds and 60 minutes.'};
      return {kind: 'clock', ms};
    }
    if (verb === 'linger') {
      const ms = parseDuration(arg);
      if (ms == null || ms < 5000 || ms > 600000) return {error: 'Linger must be between 5 seconds and 10 minutes.'};
      return {kind: 'linger', ms};
    }
    if (verb === 'retry') {
      const mode = String(arg || '').toLowerCase();
      if (!['flag', 'start', 'off'].includes(mode)) return {error: 'Use #jmp retry flag, start, or off.'};
      return {kind: 'retry', mode};
    }
    if (verb === 'camera') {
      const match=arg.match(/^fixed\s+(\d+(?:\.\d+)?)$/i),width=Number(match?.[1]);
      if(!match||width<200||width>20000)return {error:'Use #jmp camera fixed WIDTH (200�20000 map pixels).'};
      return {kind:'camera',width};
    }
    if (verb === 'wait') {
      const n = Number(arg);
      if (!Number.isInteger(n) || n < 2 || n > 15) return {error: 'Wait must be 2 to 15 seconds.'};
      return {kind: 'wait', n};
    }
    if (verb === 'seats') {
      const n = Number(arg);
      if (!Number.isInteger(n) || n < 1 || n > 16) return {error: 'Seats must be 1 to 16.'};
      return {kind: 'seats', n};
    }
    if (verb === 'play') {
      const mode = String(arg || '').toLowerCase();
      if (mode === 'race') return {kind: 'play', mode: 'race'};
      if (mode === 'survival' || mode === 'last') return {kind: 'play', mode: 'survival'};
      return {error: 'Use #jmp play race or #jmp play survival.'};
    }
    return {error: 'Unknown tag "' + line + '".'};
  }

  function compile(boxes) {
    const course = empty();
    course.boxes = Array.isArray(boxes) ? boxes : [];
    const seen = {};
    function once(key, warning) {
      if (seen[key]) {
        course.warnings.push(warning);
        return false;
      }
      seen[key] = true;
      return true;
    }
    for (const box of course.boxes) {
      const tag = parseTag(box.text);
      if (!tag) continue;
      if (tag.error) {
        course.warnings.push(tag.error);
        continue;
      }
      const at = {x: Number(box.x), y: Number(box.y), n: tag.n, ...(tag.facing?{facing:tag.facing}:{})};
      if (tag.kind === 'start' && Number.isFinite(at.x) && Number.isFinite(at.y)) course.starts.push(at);
      else if(tag.kind==='camera'&&Number.isFinite(at.x)&&Number.isFinite(at.y)&&once('camera','Repeats a fixed camera rule.'))course.camera={x:at.x,y:at.y,width:tag.width};
      else if (tag.kind === 'flag' && Number.isFinite(at.x) && Number.isFinite(at.y)) course.flags.push(at);
      else if (tag.kind === 'goal' && Number.isFinite(at.x) && Number.isFinite(at.y)) {
        if (once('goal', 'Repeats a goal that is already set.')) course.goal = {x: at.x, y: at.y};
      } else if (tag.kind === 'loops' && once('loops', 'Repeats a loops rule that is already set.')) course.loops = tag.n;
      else if (tag.kind === 'bump' && once('bump', 'Repeats a bump rule that is already set.')) course.bump = tag.on;
      else if (tag.kind === 'rider' && once('rider', 'Repeats a rider rule that is already set.')) course.rider = tag.id;
      else if (tag.kind === 'clock' && once('clock', 'Repeats a clock rule that is already set.')) course.clockMs = tag.ms;
      else if (tag.kind === 'linger' && once('linger', 'Repeats a linger rule that is already set.')) course.lingerMs = tag.ms;
      else if (tag.kind === 'retry' && once('retry', 'Repeats a retry rule that is already set.')) course.retry = tag.mode;
      else if (tag.kind === 'wait' && once('wait', 'Repeats a wait rule that is already set.')) course.waitSec = tag.n;
      else if (tag.kind === 'seats' && once('seats', 'Repeats a seats rule that is already set.')) course.seats = tag.n;
      else if (tag.kind === 'play' && once('play', 'Repeats a play rule that is already set.')) course.play = tag.mode;
    }
    const numberedStarts = course.starts.filter((item) => item.n != null).sort((a, b) => a.n - b.n || a.x - b.x);
    const looseStarts = course.starts.filter((item) => item.n == null);
    course.starts = numberedStarts.concat(looseStarts);
    const numberedFlags = course.flags.filter((item) => item.n != null).sort((a, b) => a.n - b.n || a.x - b.x);
    const looseFlags = course.flags.filter((item) => item.n == null);
    const flagNums = numberedFlags.map((item) => item.n);
    if (new Set(flagNums).size !== flagNums.length) course.warnings.push('Two flags have the same number.');
    course.ordered = numberedFlags.length > 0 && numberedFlags.length === course.flags.length;
    if (course.goal || course.loops) course.ordered = numberedFlags.length === course.flags.length && (numberedFlags.length > 0 || !course.loops);
    course.flags = course.ordered ? numberedFlags : numberedFlags.concat(looseFlags);
    if (course.loops && !course.goal) {
      course.warnings.push('Loops need a #jmp goal.');
      course.loops = null;
    }
    if (course.loops && !course.flags.length) course.warnings.push('A looped course needs at least one #jmp flag.');
    if (course.play === 'survival' && course.retry && course.retry !== 'off') {
      course.warnings.push('Survival courses never allow retries.');
      course.retry = 'off';
    }
    if (course.play === 'survival') course.retry = 'off';
    for (let i = 0; i < course.starts.length; i++) {
      for (let j = i + 1; j < course.starts.length; j++) {
        const dx = course.starts[i].x - course.starts[j].x;
        const dy = course.starts[i].y - course.starts[j].y;
        if (dx * dx + dy * dy < 80 * 80) course.warnings.push('Two start points are almost on top of each other.');
      }
    }
    return course;
  }

  function readText(obj) {
    if (!obj || typeof obj !== 'object') return '';
    return [obj.caption, obj.text, obj.label, obj.tf?.text, obj.textField?.text, obj.textSprite?.text].find(value => typeof value === 'string' && value.trim()) || '';
  }

  function collect(session) {
    const boxes = [];
    const seen = new Set();
    function walk(obj, depth) {
      if (!obj || typeof obj !== 'object' || seen.has(obj) || depth > 10) return;
      seen.add(obj);
      const text = readText(obj);
      const x = Number(obj.x ?? obj._x);
      const y = Number(obj.y ?? obj._y);
      if (text && Number.isFinite(x) && Number.isFinite(y) && /^#jmp\b/i.test(firstLine(text))) {
        boxes.push({text: firstLine(text), body: text, x, y, node: obj});
        return; // Its text-field child is the same tag at local (0,0), not another marker.
      }
      if (Array.isArray(obj)) {
        for (const item of obj) walk(item, depth + 1);
        return;
      }
      if (obj instanceof Map) {
        for (const item of obj.values()) walk(item, depth + 1);
        return;
      }
      if (typeof obj.GetUserData === 'function') walk(obj.GetUserData(), depth + 1);
      for (const key of KEYS) if (obj[key] != null) walk(obj[key], depth + 1);
      // Native display containers expose Flash-style children, not always an array.
      if (typeof obj.getChildAt === 'function' && Number.isInteger(obj.numChildren)) {
        for (let i = 0; i < obj.numChildren; i++) walk(obj.getChildAt(i), depth + 1);
      }
    }
    walk(session, 0);
    const source=(session?.level||session?._level)?.shapeGuide;
    if(Array.isArray(source?.__jmpCourseBoxes)){const collected=source.__jmpCourseBoxes
      .filter(box=>typeof box.text==='string'&&/^#jmp\b/i.test(firstLine(box.text))&&Number.isFinite(box.x)&&Number.isFinite(box.y))
      .map(box=>({text:firstLine(box.text),body:box.text,x:box.x,y:box.y,
        node:boxes.find(found=>found.text===firstLine(box.text)&&Math.abs(found.x-box.x)<.01&&Math.abs(found.y-box.y)<.01)?.node}));
      // Native text may use group-local coordinates while XML uses level coordinates.
      // Hide every detected label without changing the authoritative marker positions.
      collected.visualNodes=boxes.map(box=>box.node);return collected;
    }
    return boxes;
  }

  function hideMarks(course) {
    const nodes=new Set([...(course?.boxes||[]).map(box=>box.node),...(course?.boxes?.visualNodes||[])]);
    for (const node of nodes) {
      if (!node) continue;
      try { node.visible = false; } catch {}
      try { node.renderable = false; } catch {}
      try { node.alpha = 0; } catch {}
      try { if (node.textField) node.textField.visible = false; } catch {}
      // Camera culling writes PIXI visible directly. Keep metadata in place,
      // but prevent rendering even when culling or a shared snapshot unhides it.
      try { const sprite = node.pixiSprite || node._pixiSprite; if (sprite) sprite.renderable = false; } catch {}
    }
  }

  function tagged(course) {
    return !!(course && (course.camera || course.starts.length || course.flags.length || course.goal || course.loops || course.bump != null || course.rider || course.clockMs || course.lingerMs || course.retry || course.waitSec || course.seats || course.play));
  }

  function summary(course) {
    if (!tagged(course)) return '';
    const bits = [];
    if (course.play === 'survival') bits.push('survival');
    if (course.loops) bits.push(course.loops + ' loops');
    if(course.camera)bits.push('Fixed camera � '+course.camera.width+'px wide');
    if (course.starts.length) bits.push(course.starts.length + ' starts');
    if (course.flags.length) bits.push(course.flags.length + ' flags');
    if (course.goal) bits.push('custom goal');
    if (course.bump != null) bits.push(course.bump ? 'bump on' : 'bump off');
    if (course.rider) bits.push(riderName(course.rider) || ('rider ' + course.rider));
    if (course.clockMs) bits.push(Math.round(course.clockMs / 1000) + 's clock');
    if (course.seats) bits.push(course.seats + ' seats');
    if (course.retry) bits.push('retry ' + course.retry);
    if (course.waitSec) bits.push(course.waitSec + 's wait');
    if (course.lingerMs) bits.push(Math.round(course.lingerMs / 1000) + 's linger');
    return bits.join(' Â· ');
  }

  function slotFor(course, index) {
    if (!course?.starts?.length) return null;
    const i = Math.max(0, Number(index) || 0) % course.starts.length;
    return course.starts[i];
  }

  function near(px, py, mark, reach) {
    if (!mark || !Number.isFinite(px) || !Number.isFinite(py)) return false;
    const r = reach || REACH;
    const dx = px - mark.x;
    const dy = py - mark.y;
    return dx * dx + dy * dy <= r * r;
  }

  function freshRun() {
    return {next: 0, loop: 0, last: null, done: false};
  }

  function steps(course) {
    const flags = course?.flags?.length || 0;
    const goal = course?.goal ? 1 : 0;
    const loops = Math.max(1, course?.loops || 1);
    return Math.max(1, (flags + goal) * loops);
  }

  function progress(course, run) {
    if (!course || run?.done) return 1;
    const flags = course.flags.length;
    const goal = course.goal ? 1 : 0;
    const loops = Math.max(1, course.loops || 1);
    const total = Math.max(1, (flags + goal) * loops);
    const done = Math.min(total, (run?.loop || 0) * (flags + goal) + (run?.next || 0));
    return Math.max(0, Math.min(0.99, done / total));
  }

  function advance(course, run, px, py) {
    if (!course || !run || run.done) return run;
    if (course.ordered) {
      const flag = course.flags[run.next];
      if (flag && near(px, py, flag)) {
        run.next += 1;
        run.last = flag;
      }
      if (run.next >= course.flags.length) {
        if (course.goal) {
          if (near(px, py, course.goal)) {
            run.loop += 1;
            run.last = course.goal;
            if (run.loop >= Math.max(1, course.loops || 1)) run.done = true;
            else run.next = 0;
          }
        } else if (!course.loops && course.flags.length) {
          run.last = course.flags[course.flags.length - 1];
        }
      }
      return run;
    }
    for (const flag of course.flags) {
      if (near(px, py, flag)) run.last = flag;
    }
    if (course.goal && near(px, py, course.goal)) {
      run.done = true;
      run.last = course.goal;
    }
    return run;
  }

  function shiftCharacter(character, world, x, y) {
    if (!character || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    const scale = character.m_physScale || world?.m_physScale || 30;
    const focus = character.cameraFocus?.GetPosition?.() || character.cameraFocus?.GetWorldCenter?.() || character.body?.GetPosition?.();
    if (!focus || !Number.isFinite(focus.x)) return false;
    const dx = x / scale - focus.x;
    const dy = y / scale - focus.y;
    const seen = new Set();
    const bodies = [];
    function add(body) {
      if (body && typeof body.GetPosition === 'function' && !seen.has(body)) {
        seen.add(body);
        bodies.push(body);
      }
    }
    for (const key of ['body', 'centralBody', 'cameraFocus', 'pelvis', 'chest', 'hip', 'torso', 'm_body', 'head']) add(character[key]);
    for (const body of character.paintVector || []) add(body);
    if (Array.isArray(character._bodies)) for (const body of character._bodies) add(body);
    if (!bodies.length) return false;
    for (const body of bodies) {
      const at = body.GetPosition();
      const angle = body.GetAngle?.() || 0;
      const next = {x: at.x + dx, y: at.y + dy};
      try {
        if (typeof body.SetXForm === 'function') body.SetXForm(next, angle);
        else body.SetTransform?.(next, angle);
        body.SetLinearVelocity?.({x: 0, y: 0});
        body.SetAngularVelocity?.(0);
      } catch {}
    }
    try { character._startX = x / scale; character._startY = y / scale; } catch {}
    return true;
  }

  const api = {
    MARK, CATALOG, REACH, RIDERS, parseDuration, parseRider, riderName, parseTag, compile, collect, hideMarks,
    namedForCatalog, tagged, summary, empty, slotFor, near, freshRun, steps, progress, advance, shiftCharacter,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HWJimbobCourse = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
