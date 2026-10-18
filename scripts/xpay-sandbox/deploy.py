"""Create only the isolated test service; never change main/dev app deployments."""
import hashlib
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path('/home/ubuntu/coachlink-xpay-sandbox-20261011')
K = ['sudo', '-n', 'kubectl', '--kubeconfig=/etc/kubernetes/admin.conf']
NAME = 'coachlink-xpay-sandbox-20261011'
LIVE = '--live' in sys.argv
STATE = '/home/ubuntu/coachlink-xpay-sandbox-20261011/live-state'
def run(args, **kwargs):
    return subprocess.run(args, check=True, text=True, capture_output=True, **kwargs).stdout
def get(kind, name):
    return json.loads(run(K + ['-n', 'default', 'get', kind, name, '-o', 'json']))
def apply(value):
    print(run(K + ['apply', '-f', '-'], input=json.dumps(value)).strip())
dep = get('deployment', 'coachlink-dev')
app = next(c for c in dep['spec']['template']['spec']['containers'] if c['name'] == 'coachlink-dev')
image = app['image']
assert image == 'ccr.ccs.tencentyun.com/littlehorse/coachlink@sha256:94d62a4d38aea4e4a4efdab80a105d6d72129beb9bbbe2cfc2b6012d238118b1', 'Dev baseline changed; stop'
if LIVE:
    main = get('deployment', 'coachlink-main')
    assert next(c for c in main['spec']['template']['spec']['containers'] if c['name'] == 'coachlink-main')['image'].endswith('3e446dd3d8e72676d048d47b1b1edc46f6c4381bc2f8bbc6c04932cf958fe031'), 'Main baseline changed; stop'
    assert any(v.get('secret', {}).get('secretName') == 'coachlink-main-apollo-config' for v in main['spec']['template']['spec']['volumes'])
    run(['sudo', '-n', 'install', '-d', '-m', '700', '-o', '1001', '-g', '1001', STATE])
services = json.loads(run(K + ['get', 'svc', '-A', '-o', 'json']))['items']
assert not any(p.get('nodePort') == 30019 and svc['metadata']['name'] != NAME for svc in services for p in svc['spec'].get('ports', [])), 'Port is owned by another service'
code = (ROOT / 'server.cjs').read_text()
assert len(code.encode()) < 300000
meta = {'name': NAME, 'namespace': 'default', 'labels': {'app': NAME, 'purpose': 'android-xpay-sandbox'}}
apply({'apiVersion': 'v1', 'kind': 'ConfigMap', 'metadata': meta, 'data': {'server.cjs': code}})
apply({'apiVersion': 'apps/v1', 'kind': 'Deployment', 'metadata': meta, 'spec': {
    'replicas': 1, 'strategy': {'type': 'Recreate'}, 'selector': {'matchLabels': {'app': NAME}}, 'template': {
      'metadata': {'labels': {'app': NAME}, 'annotations': {'bundle-sha256': hashlib.sha256(code.encode()).hexdigest()}},
      'spec': {'automountServiceAccountToken': False, 'securityContext': {'runAsUser': 1001, 'runAsGroup': 1001, 'fsGroup': 1001},
        'imagePullSecrets': dep['spec']['template']['spec'].get('imagePullSecrets', []),
        'containers': [{'name': 'sandbox', 'image': image, 'command': ['node', '/sandbox/server.cjs'],
          'env': [{'name': 'NODE_ENV', 'value': 'production'}, {'name': 'XPAY_TEST_STAGE', 'value': 'live' if LIVE else 'sandbox'}, {'name': 'XPAY_TEST_DURABLE_STATE', 'value': 'true' if LIVE else 'false'}], 'ports': [{'containerPort': 4109}],
          'resources': {'requests': {'cpu': '10m', 'memory': '32Mi'}, 'limits': {'cpu': '250m', 'memory': '128Mi'}},
          'securityContext': {'allowPrivilegeEscalation': False, 'readOnlyRootFilesystem': True, 'capabilities': {'drop': ['ALL']}},
          'readinessProbe': {'httpGet': {'path': '/api/payment/wechat/xpay/' + ('live-test' if LIVE else 'sandbox') + '/health', 'port': 4109}, 'initialDelaySeconds': 4, 'periodSeconds': 5},
          'volumeMounts': [{'name': 'code', 'mountPath': '/sandbox', 'readOnly': True}, {'name': 'apollo', 'mountPath': '/app/.env', 'subPath': 'dotenv', 'readOnly': True}, {'name': 'state', 'mountPath': '/sandbox-state'}]}],
        'volumes': [{'name': 'code', 'configMap': {'name': NAME}}, {'name': 'apollo', 'secret': {'secretName': 'coachlink-main-apollo-config' if LIVE else 'coachlink-dev-apollo-config'}}, {'name': 'state', **({'hostPath': {'path': STATE, 'type': 'Directory'}} if LIVE else {'emptyDir': {'sizeLimit': '2Mi'}})}]}}}})
apply({'apiVersion': 'v1', 'kind': 'Service', 'metadata': meta, 'spec': {'type': 'NodePort', 'selector': {'app': NAME}, 'ports': [{'port': 4109, 'targetPort': 4109, 'nodePort': 30019}]}})
print(run(K + ['-n', 'default', 'rollout', 'status', 'deployment/' + NAME, '--timeout=40s']).strip())
print('No main/dev deployment changed; isolated ' + ('live cash verification' if LIVE else 'sandbox') + ' ready internally')
