/**
 * main.js — Application entry point.
 * Initializes all modules and wires up the story generation engine.
 */

// ── State ────────────────────────────────────────────────────────────────────
import { getSession, setStreaming, setStoryId, setInitialized } from './state/session.js';
import { appendNode, initTree, getTree, finalizeNodeText, getHistoryMessages } from './state/story-tree.js';
import { createCharacter, getActiveCharacter, getAllCharacters, loadCharacters, setActiveCharacter } from './state/characters.js';
import { getWorld, getActiveLocation, initWorld, setActiveLocation } from './state/world.js';

// ── Persistence ───────────────────────────────────────────────────────────────
import { forceSave, initAutosave, loadStoryIntoStore } from './persistence/autosave.js';
import { listStories } from './persistence/db.js';

// ── API ───────────────────────────────────────────────────────────────────────
import { streamGrok } from './api/grok.js';
import { buildSystemPrompt, buildMessages, buildOpeningPrompt, buildTransitionPrompt, buildArcPrompt } from './api/prompts.js';

// ── UI ────────────────────────────────────────────────────────────────────────
import { initAppShell } from './ui/app-shell.js';
import { initStoryPanel } from './ui/story-panel.js';
import { initInputPanel } from './ui/input-panel.js';
import { initSidebarLeft } from './ui/sidebar-left.js';
import { initSidebarRight } from './ui/sidebar-right.js';
import { initSettingsModal } from './ui/settings-modal.js';
import { initWizard } from './ui/wizard.js';
import { initCharacterEditor } from './ui/character-editor.js';
import { initWorldEditor } from './ui/world-editor.js';
import { initTimelineViewer } from './ui/timeline-viewer.js';
import { initMediaPanel } from './ui/media-panel.js';
import { initTTS } from './ui/tts-engine.js';
import { initTTSSettings } from './ui/tts-settings.js';
import bus from './utils/events.js';
import { uid } from './utils/uid.js';

let _generationInFlight = false;

// ── Boot ──────────────────────────────────────────────────────────────────────

async function boot() {
  // Initialize all UI modules
  initAppShell();
  initStoryPanel();
  initInputPanel();
  initSidebarLeft();
  initSidebarRight();
  initSettingsModal();
  initWizard();
  initCharacterEditor();
  initWorldEditor();
  initTimelineViewer();
  initMediaPanel();
  initTTS();
  initTTSSettings();
  initAutosave();

  // Wire story generation events
  bus.on('story:generate', _onGenerate);
  bus.on('story:begin', _onStoryBegin);
  bus.on('story:transition', _onTransition);
  bus.on('story:load', ({ storyId }) => _loadStory(storyId));

  // Keyboard shortcuts (global)
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('dialog[open]').forEach(d => d.close());
    }
  });

  // Check for existing stories
  const session = getSession();
  if (!session.apiKey) {
    // First time — show settings prompt
    _showWelcome();
  } else {
    // Try to restore the most recent story
    await _tryRestoreLastStory();
  }
}

// ── Story Generation ─────────────────────────────────────────────────────────

async function _onGenerate({ userInput, mode }) {
  const session = getSession();
  if (session.isStreaming || _generationInFlight) return;
  if (!session.apiKey) {
    bus.emit('toast', { message: 'Add your Grok API key in Settings (⚙).', type: 'error' });
    return;
  }

  const tree = getTree();
  if (!tree?.rootId) {
    bus.emit('toast', { message: 'Start a new story first.', type: 'error' });
    return;
  }

  const world = getWorld();
  const location = getActiveLocation();
  const char = getActiveCharacter();
  const allChars = Object.values(getAllCharacters());
  const historyMessages = getHistoryMessages(tree.activeNodeId, 15);

  const arc = tree.arcs[tree.activeArcId];
  const prompt = tree.activeArcId !== 'arc_main'
    ? buildArcPrompt({
        arcName: arc?.name ?? 'Parallel Arc',
        world,
        location,
        character: char,
        allChars,
        historyMessages,
        userInput,
        mode
      })
    : {
        systemPrompt: buildSystemPrompt({ world, location, activeChar: char, allChars, mode }),
        messages: buildMessages({ historyMessages, userInput, mode, activeChar: char })
      };

  await _stream({
    systemPrompt: prompt.systemPrompt,
    messages: prompt.messages,
    userInput,
    mode,
    actorName: char?.name ?? 'Player',
    sessionSnapshot: {
      activeCharacterId: char?.id ?? null,
      locationId: world?.activeLocationId ?? null,
      activeArcId: tree.activeArcId
    },
    streamTarget: { arcId: tree.activeArcId, parentNodeId: tree.activeNodeId }
  });
}

async function _onStoryBegin({ setup, initialConflict }) {
  const session = getSession();
  if (session.isStreaming || _generationInFlight) {
    bus.emit('toast', { message: 'Stop the current generation before starting a new story.', type: 'error' });
    return;
  }
  if (!session.apiKey) {
    bus.emit('toast', { message: 'Set your Grok API key in Settings before starting.', type: 'error' });
    bus.emit('settings:open');
    return;
  }

  try {
    await forceSave();
  } catch (err) {
    bus.emit('toast', { message: `Could not save the current story: ${err.message}`, type: 'error' });
    return;
  }
  setStoryId(null);

  initWorld({
    name: setup.worldName,
    genre: setup.genre,
    tone: setup.tone,
    globalLore: setup.worldLore,
    startingLocation: {
      name: setup.locationName,
      description: setup.locationDesc,
      weather: setup.locationWeather
    }
  });

  loadCharacters({ all: {}, activeId: null });
  const charId = createCharacter({
    name: setup.charName,
    role: setup.charRole,
    backstory: setup.charBackstory,
    goals: setup.charGoals,
    isPlayer: true
  });
  setActiveCharacter(charId);

  const world = getWorld();
  const location = getActiveLocation();
  const char = getActiveCharacter();

  // Initialize the story tree
  const storyId = uid('story');
  setStoryId(storyId);
  initTree({
    narrativeText: '',
    locationId: world?.activeLocationId ?? null,
    activeCharacterId: char?.id ?? null
  });

  setInitialized(true);
  bus.emit('story:started');

  const { systemPrompt, messages } = buildOpeningPrompt({
    world,
    location,
    activeChar: char,
    initialConflict
  });

  await _stream({
    systemPrompt,
    messages,
    userInput: '',
    mode: 'narrator',
    actorName: 'Narrator',
    sessionSnapshot: {
      activeCharacterId: char?.id ?? null,
      locationId: world?.activeLocationId ?? null,
      activeArcId: 'arc_main'
    },
    streamTarget: { openingNodeId: getTree()?.rootId },
    isOpening: true
  });

  bus.emit('sidebar:refresh');
}

async function _onTransition({ fromLocationName, toLocation }) {
  const session = getSession();
  if (!session.apiKey || !toLocation || session.isStreaming || _generationInFlight) {
    if (session.isStreaming || _generationInFlight) {
      bus.emit('toast', { message: 'Wait for the current generation to finish before traveling.', type: 'error' });
    }
    return;
  }

  const world = getWorld();
  const tree = getTree();
  const char = getActiveCharacter();
  const previousLocationId = world?.activeLocationId ?? null;
  setActiveLocation(toLocation.id);

  const { systemPrompt, messages } = buildTransitionPrompt({
    fromLocationName,
    toLocation,
    world,
    activeChar: char
  });

  const completed = await _stream({
    systemPrompt,
    messages,
    userInput: `[Travel to ${toLocation.name}]`,
    mode: 'narrator',
    actorName: 'Narrator',
    sessionSnapshot: {
      activeCharacterId: char?.id ?? null,
      locationId: toLocation.id,
      activeArcId: tree?.activeArcId ?? 'arc_main'
    },
    streamTarget: { arcId: tree?.activeArcId, parentNodeId: tree?.activeNodeId }
  });

  if (!completed && previousLocationId) setActiveLocation(previousLocationId);

  bus.emit('sidebar:refresh');
}

// ── Core Streaming Engine ─────────────────────────────────────────────────────

async function _stream({
  systemPrompt,
  messages,
  userInput,
  mode,
  actorName,
  sessionSnapshot,
  streamTarget,
  isOpening = false
}) {
  if (_generationInFlight || getSession().isStreaming) return false;
  _generationInFlight = true;
  const session = getSession();
  const abortController = new AbortController();
  setStreaming(true, abortController);

  bus.emit('stream:start', { userInput, mode, actorName });

  let fullText = '';
  let completed = false;

  try {
    const gen = streamGrok({
      apiKey: session.apiKey,
      model: session.model ?? 'grok-4',
      systemPrompt,
      messages,
      maxTokens: 1024,
      signal: abortController.signal
    });

    for await (const token of gen) {
      fullText += token;
      bus.emit('stream:token', { text: token });
    }

    // Persist the completed node
    if (isOpening) {
      // Update root node text
      if (streamTarget?.openingNodeId) {
        finalizeNodeText(streamTarget.openingNodeId, fullText, fullText);
      }
    } else {
      appendNode({
        userInput,
        narrativeText: fullText,
        deltaText: fullText,
        actorId: mode === 'narrator' ? 'narrator' : (sessionSnapshot?.activeCharacterId ?? 'narrator'),
        sessionSnapshot,
        arcId: streamTarget?.arcId,
        parentId: streamTarget?.parentNodeId
      });
    }

    bus.emit('stream:end');
    completed = true;

  } catch (err) {
    if (err.name === 'AbortError') {
      // User cancelled — still save what we have
      if (fullText) {
        if (isOpening) {
          if (streamTarget?.openingNodeId) {
            finalizeNodeText(streamTarget.openingNodeId, fullText, fullText);
          }
        } else {
          appendNode({
            userInput,
            narrativeText: fullText,
            deltaText: fullText,
            actorId: mode === 'narrator' ? 'narrator' : (sessionSnapshot?.activeCharacterId ?? 'narrator'),
            sessionSnapshot,
            arcId: streamTarget?.arcId,
            parentId: streamTarget?.parentNodeId
          });
        }
        completed = true;
      }
      bus.emit('stream:end');
    } else {
      bus.emit('stream:error', { message: err.message });
      bus.emit('toast', { message: `Generation error: ${err.message}`, type: 'error' });
    }
  } finally {
    setStreaming(false, null);
    _generationInFlight = false;
  }
  return completed;
}

// ── Story Load / Restore ──────────────────────────────────────────────────────

async function _loadStory(storyId) {
  if (getSession().isStreaming || _generationInFlight) {
    bus.emit('toast', { message: 'Stop the current generation before loading another story.', type: 'error' });
    return;
  }
  try {
    await forceSave();
    await loadStoryIntoStore(storyId);
    setInitialized(true);
    bus.emit('story:loaded');
    bus.emit('sidebar:refresh');
    bus.emit('toast', { message: 'Story loaded.', type: 'success' });
  } catch (err) {
    bus.emit('toast', { message: `Failed to load story: ${err.message}`, type: 'error' });
  }
}

async function _tryRestoreLastStory() {
  try {
    const stories = await listStories();
    if (stories.length > 0) {
      await _loadStory(stories[0].id);
    } else {
      _showWelcome();
    }
  } catch (_) {
    _showWelcome();
  }
}

function _showWelcome() {
  // Show the welcome screen (visible by default, hidden once story starts)
  const welcome = document.getElementById('welcome-screen');
  if (welcome) welcome.classList.remove('hidden');
}

// ── Start ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', boot);
