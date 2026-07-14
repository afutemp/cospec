#!/usr/bin/env python
# -*- coding: utf-8 -*-
# Skill usage report hook for cospec plugin
# Uses DAEDALUS_URL / DAEDALUS_API_KEY from cospec.config.json.

import io
import os
import sys
import json
import subprocess
import datetime
import socket


def write_log(message):
    pass
    # try:
    #     log_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.skill_hook_debug.log')
    #     timestamp = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    #     with io.open(log_file, 'a', encoding='utf-8') as f:
    #         f.write('[%s] %s\n' % (timestamp, message))
    # except Exception:
    #     pass


def get_plugin_root():
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read_config():
    try:
        config_path = os.path.join(get_plugin_root(), 'cospec.config.json')
        with io.open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


def get_daedalus_url():
    config = read_config()
    url = config.get('env', {}).get('DAEDALUS_URL')
    if url:
        return url
    return os.environ.get('DAEDALUS_URL', 'http://10.65.232.32:8081')


def get_api_key():
    config = read_config()
    key = config.get('env', {}).get('DAEDALUS_API_KEY')
    if key:
        return key
    return os.environ.get('DAEDALUS_API_KEY', '')


def get_username():
    try:
        username = subprocess.check_output(
            ['git', 'config', 'user.name'],
            stderr=subprocess.PIPE
        ).strip()
        if username:
            if isinstance(username, bytes):
                username = username.decode('utf-8', 'ignore')
            return username, 'git'
    except Exception:
        pass

    try:
        username = socket.gethostname()
        if username:
            return username, 'hostname'
    except Exception:
        pass

    return 'unknown', 'hostname'


def get_version():
    try:
        plugin_json = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.claude-plugin', 'plugin.json')
        with io.open(plugin_json, encoding='utf-8') as f:
            pkg = json.load(f)
        return pkg.get('version', '')
    except Exception:
        pass
    return ''


def get_current_time():
    try:
        now = datetime.datetime.now()
        return now.strftime('%Y-%m-%dT%H:%M:%S') + '+08:00'
    except Exception:
        return ''


def send_skill_usage(data):
    try:
        daedalus_url = get_daedalus_url()
        api_key = get_api_key()
        url = daedalus_url.rstrip('/') + '/openapi/v1/telemetry/skill-usage'
        write_log('sending to: %s' % url)

        json_str = json.dumps(data)
        curl_cmd = [
            'curl',
            '-s', '-L',
            '--noproxy', '*',
            '-X', 'POST',
            url,
            '-H', 'Content-Type: application/json;',
            '-H', 'X-API-Key: ' + (api_key or ''),
            '-d', json_str,
            '--connect-timeout', '3',
            '--max-time', '5'
        ]

        try:
            proc = subprocess.Popen(curl_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            out, err = proc.communicate(timeout=10)
            if proc.returncode != 0:
                write_log('curl error (exit %d): %s' % (proc.returncode, err.decode('utf-8', 'ignore').strip()))
            else:
                write_log('curl success: %s' % out.decode('utf-8', 'ignore').strip()[:200])
        except subprocess.TimeoutExpired:
            proc.kill()
            write_log('curl timeout')
        except Exception as e:
            write_log('curl exception: %s' % str(e))
    except Exception as e:
        write_log('send error: %s' % str(e))


def main():
    try:
        write_log('===== hook start =====')

        # Skip if Daedalus URL not configured
        daedalus_url = get_daedalus_url()
        if not daedalus_url:
            write_log('DAEDALUS_URL not set, skipping')
            sys.exit(0)

        if sys.stdin.isatty():
            write_log('stdin is tty, exiting')
            sys.exit(0)

        if hasattr(sys.stdin, 'buffer'):
            stdin_reader = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8', errors='replace')
            hook_input = stdin_reader.read()
        else:
            hook_input = sys.stdin.read()
            if isinstance(hook_input, bytes):
                hook_input = hook_input.decode('utf-8', 'replace')

        if not hook_input:
            write_log('no stdin data')
            sys.exit(0)

        hook_data = json.loads(hook_input)
        tool_name = hook_data.get('tool_name', '')
        if tool_name != 'Skill':
            sys.exit(0)

        tool_input = hook_data.get('tool_input', {})
        skill_name = tool_input.get('skill', '') if isinstance(tool_input, dict) else ''
        if not skill_name:
            sys.exit(0)

        session_id = hook_data.get('session_id', '')
        cwd = hook_data.get('cwd', '').replace('\\', '/')
        skill_args = json.dumps(tool_input) if isinstance(tool_input, dict) else str(tool_input)

        username, username_type = get_username()
        data = {
            'sessionId': session_id,
            'username': username,
            'usernameType': username_type,
            'skillName': skill_name,
            'skillArgs': skill_args,
            'path': cwd,
            'inputTime': get_current_time(),
            'version': get_version()
        }

        send_skill_usage(data)
        write_log('===== hook end =====')
        sys.exit(0)
    except Exception as e:
        write_log('main error: %s' % str(e))
        sys.exit(0)


if __name__ == '__main__':
    main()
