# Independent reference for the deadlift: normalized cross-correlation on the plate hub from a hand-picked start.
import cv2, json, sys
import numpy as np
path, start, x, y, half = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
out = sys.argv[6]
cap = cv2.VideoCapture(path); frames = []
while True:
    ok, f = cap.read()
    if not ok: break
    frames.append(cv2.cvtColor(f, cv2.COLOR_BGR2GRAY))
cap.release()
n = len(frames); pts = np.full((n, 3), np.nan)
def tmpl(i, cx, cy):
    return frames[i][cy-half:cy+half, cx-half:cx+half].copy()
def run(order):
    cx, cy = x, y; t = tmpl(start, cx, cy)
    for i in order:
        g = frames[i]; s = half*3
        x0, y0 = max(0, cx-s), max(0, cy-s)
        roi = g[y0:cy+s, x0:cx+s]
        if roi.shape[0] < 2*half or roi.shape[1] < 2*half: break
        r = cv2.matchTemplate(roi, t, cv2.TM_CCOEFF_NORMED)
        _, score, _, loc = cv2.minMaxLoc(r)
        cx, cy = x0+loc[0]+half, y0+loc[1]+half
        pts[i] = (cx, cy, score)
        if score > 0.8 and cx-half >= 0 and cy-half >= 0: t = tmpl(i, cx, cy)
run(range(start, n)); run(range(start-1, -1, -1))
np.save(out, pts)
for i in list(range(0, n, 20)) + [250, 270, 290, 313]:
    print(i, pts[i].round(2).tolist())
