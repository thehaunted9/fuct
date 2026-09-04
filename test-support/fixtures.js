export function makeStoryBundle() {
  const timestamp = 1700000000000;
  return {
    schemaVersion: 1,
    id: 'story_test',
    title: 'Test Story',
    createdAt: timestamp,
    updatedAt: timestamp,
    tree: {
      rootId: 'node_root',
      activeNodeId: 'node_root',
      checkpointIds: [],
      activeArcId: 'arc_main',
      nodes: {
        node_root: {
          id: 'node_root',
          parentId: null,
          childIds: [],
          createdAt: timestamp,
          isCheckpoint: false,
          label: 'Story begins',
          narrativeText: 'Opening scene',
          deltaText: 'Opening scene',
          actorId: 'narrator',
          userInput: '',
          sessionSnapshot: {
            activeCharacterId: 'char_player',
            locationId: 'loc_start',
            activeArcId: 'arc_main'
          }
        }
      },
      arcs: {
        arc_main: { name: 'Main', nodeIds: ['node_root'], activeNodeId: 'node_root' }
      }
    },
    characters: {
      activeId: 'char_player',
      all: {
        char_player: {
          id: 'char_player',
          name: 'Avery',
          isPlayer: true,
          role: 'Scout',
          backstory: '',
          strengths: [],
          weaknesses: [],
          goals: [],
          relationships: {},
          appearance: '',
          voiceTone: '',
          currentState: { mood: 'neutral', health: 'healthy' },
          ttsProfile: { voiceURI: '', rate: 1, pitch: 1, volume: 1 }
        }
      }
    },
    world: {
      id: 'world_test',
      name: 'Test World',
      genre: 'fantasy',
      tone: 'adventurous',
      globalLore: '',
      factions: [],
      activeLocationId: 'loc_start',
      locations: {
        loc_start: {
          id: 'loc_start',
          name: 'Start',
          description: '',
          weather: '',
          ambientSoundtrack: '',
          imageUrl: '',
          localConflicts: [],
          connectedLocationIds: [],
          loreEntries: []
        }
      }
    }
  };
}
