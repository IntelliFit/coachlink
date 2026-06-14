import requests as r
import os
import shutil
import zipfile

# 下载 压缩包
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    'Cookie': 'cna=5gRHImcXRzgCAdoEpqI18F/x; EGG_SESS_ICONFONT=Hu68kBY7XO7C6Udp3T99M1asKmUZ0gxjps8xjTrjx4aHaXwoIsDX25rpXZ2zp9tczibClyXdTQqv_kqXliYYcWh_kMWCtPFlIrsf2FjzFBCjiGmKQ7lW6AIH0vgu9hrxgtY-mf-pGEW-peFqGvx9E3wNDoDw6oCRncJGRR57CxIuU05blvbyBAcxHLJ3bsN_J9v0hgbxdFP4s8cEJN_NdMYvJK2nsbd34loQ3r7K2EekfGLi-BqZSDLN-cZrQ4wU; u=10114852; u.sig=mv5vi-TPPlhvQJi2PMIC4VoPpD03Wc9UykMTMiG6ElA; xlly_s=1; tfstk=gnPIE32-1uFZWZ7d2H7w5pVJbGh7AN5VVUg8ozdeyXhp23UxbyPETzJ7VlaxeWzr97G7fuZULXeUF4Z4JuMl-0o-Vuz8LN5Vgy4nZbU50s5qtk0LdktJ9pQ-X4gl72hU__FrZbIVbdR-KsGuAVqHpvUO54uyveE-pPHtkcKJwunKBh3jobn82uCt643IyHHp9AQsrcn-wbE8WNgrX0h-wuUt1W6ZPZmQRaBBDvWV_9znfQd81VIocyswNVPtRviYJPOJwZ0IdmUKfMZQKnM7AvNNOn0QBrZiRufDtXH7p-hLNi1I6r2avVZRcLiThWVS3WsXnDFnqoGLCGdIwfgbPxyNyKiaePVsCW62rVVUyWDqMsxK4RzbN4Nlq1ZbJkwxHWKC4bOqcD7WFFMDNViV5N9kEudDC33L989qpV0QlN_6AbMKSVGA5N9kEv3i7U715HG5.',
    'Pragma': 'no-cache',
    'sec-fetch-mode': 'navigate'
}

url = 'https://www.iconfont.cn/api/project/download.zip?spm=a313x.manage_type_myprojects.i1.d7543c303.2b6a3a81GNdcHh&pid=5163112&ctoken=null'
res = r.get(url, headers=headers)

if res.status_code:
    with open('./scripts/tmp.zip', 'wb') as fp:
        fp.write(res.content)

# 解压文件
with zipfile.ZipFile('./scripts/tmp.zip', 'r') as zipf:
    zipf.extractall('./scripts/tmp')

# 将文件搬运至工作区，我的 css 全放在 public 下面了，你的视情况而定
for parent, _, files in os.walk('./scripts/tmp'):
    for file in files:
        filepath = os.path.join(parent, file)
        if file.startswith('demo'):
            continue
        if file.endswith('.css'):
            content = open(filepath, 'r', encoding='utf-8').read().replace('font-size: 16px;', '')
            open(filepath, 'w', encoding='utf-8').write(content)
            shutil.move(filepath, os.path.join('wechat_app/src/assets/iconfont', file))
        elif file.endswith('.woff2') or file.endswith('.woff') or file.endswith('ttf'):
            shutil.move(filepath, os.path.join('wechat_app/src/assets/iconfont', file))

# 删除压缩包和解压区域
os.remove('./scripts/tmp.zip')
shutil.rmtree('./scripts/tmp')