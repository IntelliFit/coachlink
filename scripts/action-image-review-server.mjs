// Local, disk-backed review library. No business database or cloud writes.
import { createServer } from 'node:http';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const batchDir = join(root, 'design/image-workspace/action-library/reviewed-outputs/2026-10-07');
const scopeFile = join(root, 'artifacts/action-image-replacement/2026-10-07/scope-queue.json');
const htmlFile = join(root, 'scripts/action-image-review/index.html');
const defaultDataDir = join(root, 'artifacts/action-image-review');
const orderFile = join(defaultDataDir, 'order.json');
const hashCache = new Map();
const readJson = async file => JSON.parse(await readFile(file, 'utf8'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export async function loadCatalog() {
  const [scope, assets] = await Promise.all([
    readJson(scopeFile), readJson(join(batchDir, 'full-replacement/assets.json')),
  ]);
  const byUrlName = new Map(assets.map(asset => [`${asset.key}-${asset.sha256.slice(0, 12)}.png`, asset]));
  const rows = [];
  for (const row of scope) {
    if (row.status !== 'replaced_verified') {
      rows.push({ ...row, category: row.retired ? '已删除或合并' : '暂时隐藏', available: false });
      continue;
    }
    const urlName = new URL(row.imageUrl).pathname.split('/').pop();
    const asset = byUrlName.get(urlName);
    const localFile = asset?.localFile || (urlName === 'plank-v4-single-5e63bb04.png'
      ? relative(root, join(batchDir, 'plank-v4-single.png')) : null);
    if (!localFile) throw new Error(`未找到当前图片的本地原件：${row.name}`);
    const imagePath = resolve(root, localFile);
    if (!imagePath.startsWith(batchDir + '/') && !imagePath.startsWith(batchDir + '\\')) {
      throw new Error('图片必须来自已登记的动作图片目录');
    }
    // Cache by path + expected content hash, not just by action ID.
    const expected = asset?.sha256 || '5e63bb0464bedef687efb2dad6c359ba0e2447ab60084acaceedf909629f01bb';
    const cacheKey = `${imagePath}:${expected}`;
    let imageSha = hashCache.get(cacheKey);
    if (!imageSha) {
      imageSha = sha256(await readFile(imagePath));
      if (imageSha !== expected) throw new Error(`本地图片与已导入版本不一致：${row.name}`);
      hashCache.set(cacheKey, imageSha);
    }
    rows.push({
      ...row, available: true, imageSha, imagePath, localFile,
      assetKey: asset?.key || 'plank-v4-single', sourceUrl: asset?.source || '',
      category: row.originalType === 'CARDIO' ? '有氧' : row.originalType === 'STREET_REVIEW_PENDING' ? '街健' : '力量',
    });
  }
  let order;
  try { order = await readJson(orderFile); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (order) {
    const ranks = new Map(order.publicIds.map((id, index) => [id, index]));
    return rows.sort((a,b) => (ranks.get(a.publicId) ?? Number.MAX_SAFE_INTEGER) - (ranks.get(b.publicId) ?? Number.MAX_SAFE_INTEGER));
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true }));
}

async function atomicJson(file, data) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(data, null, 2) + '\n', 'utf8');
  await rename(temporary, file);
}

export async function startReviewServer({ port = 3002, dataDir = defaultDataDir } = {}) {
  await mkdir(dataDir, { recursive: true });
  const reviewsFile = join(dataDir, 'reviews.json');
  const queueFile = join(dataDir, 'rework-queue.json');
  let state;
  try { state = await readJson(reviewsFile); }
  catch (error) {
    if (error.code !== 'ENOENT') throw new Error(`审核记录读取失败，请保留并检查 ${reviewsFile}: ${error.message}`);
    state = { schemaVersion: 1, reviews: {} };
    await atomicJson(reviewsFile, state);
  }
  if (state.schemaVersion !== 1 || !state.reviews || typeof state.reviews !== 'object') {
    throw new Error('审核记录格式不兼容，已停止启动，原文件保持不变');
  }
  let catalog = await loadCatalog();
  const decisionFor = row => state.reviews[row.publicId]?.[row.imageSha] || { status: 'pending', note: '' };
  const reworkQueue = () => ({
    schemaVersion: 1, generatedAt: new Date().toISOString(),
    actions: catalog.filter(row => row.available && decisionFor(row).status === 'rejected').map(row => ({
      publicId: row.publicId, name: row.name, canonicalId: row.canonicalId,
      assetKey: row.assetKey, imageSha: row.imageSha, imageUrl: row.imageUrl,
      localFile: row.localFile, sourceUrl: row.sourceUrl, poseCount: row.poseCount,
      note: decisionFor(row).note, reviewedAt: decisionFor(row).reviewedAt,
    })),
  });
  await atomicJson(queueFile, reworkQueue());
  let writes = Promise.resolve();
  const serialized = operation => {
    const next = writes.then(operation);
    writes = next.catch(() => {});
    return next;
  };
  const server = createServer(async (req, res) => {
    const send = (code, data) => {
      res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data));
    };
    try {
      const address = server.address();
      const allowedHosts = [`127.0.0.1:${address.port}`, `localhost:${address.port}`];
      if (!allowedHosts.includes(req.headers.host)) return send(403, { error: '仅允许本机访问' });
      if (req.headers.origin && !allowedHosts.some(host => req.headers.origin === `http://${host}`)) {
        return send(403, { error: '不允许跨站访问审核库' });
      }
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'");
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(await readFile(htmlFile));
      }
      if (req.method === 'GET' && url.pathname === '/api/catalog') {
        await serialized(async () => {
          catalog = await loadCatalog();
          await atomicJson(queueFile, reworkQueue());
        });
        let reviewOrder;
        try { reviewOrder = await readJson(orderFile); } catch (error) { if (error.code !== 'ENOENT') throw error; }
        return send(200, {
          actions: catalog.map(({ imagePath, ...row }) => ({ ...row,
            imageSrc: row.available ? `/images/${row.publicId}/${row.imageSha}.png` : null,
            review: decisionFor(row),
          })), reviewsFile, queueFile, resumePublicId: reviewOrder?.lastReviewedPublicId, resumeName: reviewOrder?.lastReviewedName,
        });
      }
      if (req.method === 'GET' && url.pathname.startsWith('/images/')) {
        const [, , id, file] = url.pathname.split('/');
        const row = catalog.find(item => item.publicId === id && item.available && `${item.imageSha}.png` === file);
        if (!row) return send(404, { error: '没有这张已登记图片，请刷新审核库' });
        res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' });
        return res.end(await readFile(row.imagePath));
      }
      if (req.method === 'GET' && url.pathname === '/api/rework-queue') {
        await writes;
        res.setHeader('Content-Disposition', 'attachment; filename="coachlink-rework-queue.json"');
        return send(200, reworkQueue());
      }
      if (req.method === 'POST' && url.pathname === '/api/review') {
        if (!(req.headers['content-type'] || '').startsWith('application/json')) return send(415, { error: '需要 JSON' });
        let body = '';
        for await (const chunk of req) {
          body += chunk.toString();
          if (Buffer.byteLength(body) > 16384) return send(413, { error: '备注过长' });
        }
        let input;
        try { input = JSON.parse(body); } catch { return send(400, { error: '无效的审核记录' }); }
        if (!['pending', 'approved', 'rejected'].includes(input.status) || typeof input.note !== 'string' || input.note.length > 2000) {
          return send(400, { error: '状态或备注格式不正确' });
        }
        let result;
        await serialized(async () => {
          catalog = await loadCatalog();
          const row = catalog.find(item => item.publicId === input.publicId && item.available);
          if (!row || row.imageSha !== input.imageSha) {
            result = { code: 409, error: '这张图片已更新，请刷新后审核新版' };
            return;
          }
          const nextState = structuredClone(state);
          nextState.reviews[row.publicId] ||= {};
          const decision = { status: input.status, note: input.note.trim(), reviewedAt: new Date().toISOString() };
          nextState.reviews[row.publicId][row.imageSha] = decision;
          // Persist authoritative review first, so a failed write never produces a false saved message.
          await atomicJson(reviewsFile, nextState);
          state = nextState;
          await atomicJson(queueFile, reworkQueue());
          result = { code: 200, review: decision };
        });
        return send(result.code, result);
      }
      return send(404, { error: '未找到' });
    } catch (error) {
      console.error(error);
      if (!res.headersSent) send(500, { error: '本地读取或保存失败：' + error.message });
      else res.destroy();
    }
  });
  await new Promise((done, fail) => {
    server.once('error', fail);
    server.listen(port, '127.0.0.1', done);
  });
  console.log(`CoachLink 动作图片审核库：http://127.0.0.1:${server.address().port}`);
  console.log(`当前 ${catalog.filter(row => row.available).length} 张动作图片；审核记录 ${reviewsFile}`);
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const portIndex = process.argv.indexOf('--port');
  let port;
  if (portIndex >= 0) port = Number(process.argv[portIndex + 1]);
  else {
    const registry = await readJson(join(homedir(), '.port-man'));
    port = registry.projects[root]?.services['action-image-review'];
  }
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('请使用 port-manager 分配端口，或传 --port <端口>');
  await startReviewServer({ port });
}
