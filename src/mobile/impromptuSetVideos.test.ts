import { describe, expect, it } from 'vitest'
import { mergeImpromptuSetVideos } from '../lib/impromptuSetVideos'

describe('mergeImpromptuSetVideos', () => {
  it('attaches a video by action index when the action has no UUID', () => {
    const execution = {
      id: 'execution-1',
      action_executions: [
        {
          action_name: '公共动作',
          sets: [
            { set_number: 1, status: 'pending' },
            { set_number: 2, status: 'completed' },
          ],
        },
      ],
    }

    const merged = mergeImpromptuSetVideos(execution, [
      {
        id: 'video-2',
        action_index: 0,
        set_number: 2,
        video_url: 'https://cdn.example/video.mp4',
      },
    ])

    expect((merged.action_executions as any[])[0].sets).toEqual([
      { set_number: 1, status: 'pending' },
      {
        set_number: 2,
        status: 'completed',
        has_video: true,
        video_url: 'https://cdn.example/video.mp4',
        video_id: 'video-2',
      },
    ])
  })

  it('supports serialized snapshots and ignores invalid or unmatched rows', () => {
    const execution = {
      action_executions: JSON.stringify([
        {
          action_name: '深蹲',
          sets: [{ setNumber: 1, status: 'pending' }],
        },
      ]),
    }

    const merged = mergeImpromptuSetVideos(execution, [
      {
        id: 'wrong-action',
        action_index: 2,
        set_number: 1,
        video_url: 'https://cdn.example/wrong.mp4',
      },
      {
        id: 'invalid-set',
        action_index: 0,
        set_number: 0,
        video_url: 'https://cdn.example/invalid.mp4',
      },
    ])

    expect(merged.action_executions).toEqual([
      {
        action_name: '深蹲',
        sets: [{ setNumber: 1, status: 'pending' }],
      },
    ])
  })
})
