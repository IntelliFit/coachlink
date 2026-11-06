import { describe, expect, it } from 'vitest';
import { parseDevtoolsUploadOutput } from '../apps/wechat/scripts/devtools-upload-output';

const NOT_UPLOADED = { uploaded: false, runningPort: null };
const UPLOADED = { uploaded: true, runningPort: null };

describe('parseDevtoolsUploadOutput', () => {
  describe('success', () => {
    it('accepts the Windows console success line', () => {
      const output = [
        '- preparing',
        '√ IDE server has started, listening on http://127.0.0.1:43678',
        'total size: 10692019',
        '√ upload',
        '',
      ].join('\n');

      expect(parseDevtoolsUploadOutput(output)).toEqual(UPLOADED);
    });

    it('accepts the success line printed under Git Bash or CI', () => {
      expect(parseDevtoolsUploadOutput('✔ upload\n')).toEqual(UPLOADED);
    });

    it('accepts a coloured success line with CRLF endings', () => {
      expect(parseDevtoolsUploadOutput('- preparing\r\n\u001b[32m√\u001b[39m upload\r\n')).toEqual(UPLOADED);
    });

    it('accepts a cold start, where a failed connect comes before the upload', () => {
      const output = [
        '× IDE may already started at port 28264, trying to connect',
        '√ IDE server started successfully, listening on http://127.0.0.1:28264',
        '√ upload',
      ].join('\n');

      expect(parseDevtoolsUploadOutput(output)).toEqual(UPLOADED);
    });
  });

  describe('port mismatch', () => {
    it('reads the running port from the English message', () => {
      const output = '× IDE server has started on http://127.0.0.1:43678 and must be restarted on port 28264 first\n';

      expect(parseDevtoolsUploadOutput(output)).toEqual({ uploaded: false, runningPort: 43678 });
    });

    it('reads the running port when printed with the Git Bash symbol', () => {
      const output = '✖ IDE server has started on http://127.0.0.1:51234 and must be restarted on port 28264 first\n';

      expect(parseDevtoolsUploadOutput(output)).toEqual({ uploaded: false, runningPort: 51234 });
    });

    it('reads the running port from the Chinese message', () => {
      const output = '× IDE 已启动并在监听 http://127.0.0.1:43678，需要重启才能使用端口 28264\n';

      expect(parseDevtoolsUploadOutput(output)).toEqual({ uploaded: false, runningPort: 43678 });
    });

    it('reads the running port through colour codes', () => {
      const output =
        '\u001b[31m×\u001b[39m IDE server has started on http://127.0.0.1:43678 and must be restarted on port 28264 first\n';

      expect(parseDevtoolsUploadOutput(output)).toEqual({ uploaded: false, runningPort: 43678 });
    });

    it('does not take a port from the normal already-started line', () => {
      const output = '√ IDE server has started, listening on http://127.0.0.1:43678\n';

      expect(parseDevtoolsUploadOutput(output)).toEqual(NOT_UPLOADED);
    });

    it('does not take a port from an unrelated failure', () => {
      const output = '× request to http://127.0.0.1:43678 failed\n';

      expect(parseDevtoolsUploadOutput(output)).toEqual(NOT_UPLOADED);
    });
  });

  describe('failure', () => {
    it('rejects empty output', () => {
      expect(parseDevtoolsUploadOutput('')).toEqual(NOT_UPLOADED);
    });

    it('rejects an upload error that the CLI swallows and exits 0 on', () => {
      const output = ['- preparing', '× preparing', '[error] { code: 41002, message: "appid missing" }'].join('\n');

      expect(parseDevtoolsUploadOutput(output)).toEqual(NOT_UPLOADED);
    });

    it('rejects an upload that was started but never confirmed', () => {
      expect(parseDevtoolsUploadOutput('- preparing\n- uploading\n')).toEqual(NOT_UPLOADED);
    });

    it('rejects a failed upload line', () => {
      expect(parseDevtoolsUploadOutput('× upload\n')).toEqual(NOT_UPLOADED);
    });

    it('rejects success lines of other commands', () => {
      expect(parseDevtoolsUploadOutput('√ preview\n√ upload-info\n')).toEqual(NOT_UPLOADED);
    });

    it('rejects the success text when it only appears inside another line', () => {
      expect(parseDevtoolsUploadOutput('[error] desc was "√ upload"\n')).toEqual(NOT_UPLOADED);
    });
  });
});
