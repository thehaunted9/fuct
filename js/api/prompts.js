/**
 * Prompt builders for story generation.
 * Pure functions — given state snapshots, return system prompt strings and message arrays.
 */

/**
 * Build the system prompt for story generation.
 *
 * @param {object} params
 * @param {object} params.world          Full world object from world.js
 * @param {object} params.location       Active location object
 * @param {object} params.activeChar     Active character object (or null for narrator mode)
 * @param {object[]} params.allChars     All characters (for NPC context)
 * @param {string}  params.mode          'character' | 'narrator' | 'worldbuilder'
 * @returns {string}
 */
export function buildSystemPrompt({ world, location, activeChar, allChars = [], mode }) {
  const parts = [];

  // ── World Context ────────────────────────────────────────────────────────
  parts.push(`# Story World: ${world?.name ?? 'Unknown World'}
Genre: ${world?.genre ?? 'fantasy'} | Tone: ${world?.tone ?? 'adventurous'}
${world?.globalLore ? `\nWorld Lore:\n${world.globalLore}` : ''}`);

  // Factions
  if (world?.factions?.length) {
    const factionLines = world.factions.map(f =>
      `  - **${f.name}** (${f.disposition}): ${f.description}`
    ).join('\n');
    parts.push(`Factions:\n${factionLines}`);
  }

  // ── Active Location ──────────────────────────────────────────────────────
  if (location) {
    let locBlock = `# Current Location: ${location.name}
${location.description}`;
    if (location.weather) locBlock += `\nWeather: ${location.weather}`;
    if (location.localConflicts?.length) {
      locBlock += `\nLocal tensions: ${location.localConflicts.join('; ')}`;
    }
    if (location.loreEntries?.length) {
      const lore = location.loreEntries.map(e => `  - **${e.title}**: ${e.body}`).join('\n');
      locBlock += `\nLocal Lore:\n${lore}`;
    }
    parts.push(locBlock);
  }

  // ── Characters ───────────────────────────────────────────────────────────
  if (activeChar) {
    parts.push(`# Player Character: ${activeChar.name}
Role: ${activeChar.role || 'Unknown'}
${activeChar.backstory ? `Backstory: ${activeChar.backstory}` : ''}
Strengths: ${activeChar.strengths?.join(', ') || 'none listed'}
Weaknesses: ${activeChar.weaknesses?.join(', ') || 'none listed'}
Goals: ${activeChar.goals?.join('; ') || 'none listed'}
Voice/Tone: ${activeChar.voiceTone || 'neutral'}
Current state: ${_stateStr(activeChar.currentState)}`);
  }

  // Supporting characters (NPCs)
  const npcs = allChars.filter(c => c.id !== activeChar?.id && !c.isPlayer);
  if (npcs.length) {
    const npcLines = npcs.map(c =>
      `  - **${c.name}** (${c.role || 'NPC'}): ${c.backstory?.slice(0, 120) ?? ''}`
    ).join('\n');
    parts.push(`# Supporting Characters:\n${npcLines}`);
  }

  // ── Mode Instructions ────────────────────────────────────────────────────
  const modeInstructions = {
    character: `# Mode: Character
You are the narrator of an interactive story. The player is controlling ${activeChar?.name ?? 'the protagonist'}.
- Respond to the player's actions in second person ("You step forward...") OR third person ("${activeChar?.name ?? 'They'} reaches for the door...").
- Advance the story based on their action. Describe sensory details, NPC reactions, and consequences.
- End your response at a natural decision point, inviting the next action.
- Stay consistent with the character's voice (${activeChar?.voiceTone ?? 'neutral'}) and current state.`,

    narrator: `# Mode: Narrator
The user is writing narration and exposition for the story. They are shaping events, providing commentary, or introducing new elements.
- Collaborate with their narration: accept what they write as story truth, then continue or elaborate on it.
- You can introduce new characters, reveal backstory, or advance time ("Three days passed...").
- Write in a literary, immersive style. Match the world's tone (${world?.tone ?? 'adventurous'}).`,

    worldbuilder: `# Mode: World Builder
The user is building out the world, locations, or lore. Respond as a creative collaborator.
- Help expand the world with vivid, internally consistent details.
- Suggest names, histories, conflicts, and sensory details that fit the established genre (${world?.genre ?? 'fantasy'}) and tone.
- Provide creative options and ask clarifying questions when appropriate.`
  };

  parts.push(modeInstructions[mode] ?? modeInstructions.character);

  // ── Formatting Instructions ──────────────────────────────────────────────
  parts.push(`# Formatting
- Use markdown for emphasis: *italics* for internal thoughts, **bold** for important discoveries or revelations.
- Use paragraph breaks between scene beats.
- Write vivid, immersive prose — show don't tell.
- Do not include meta-commentary about the story or break the fourth wall.
- Keep responses to 2–5 paragraphs unless the situation calls for more.`);

  return parts.join('\n\n');
}

/**
 * Build the messages array for a story generation call.
 * Combines conversation history with the new user input.
 *
 * @param {object} params
 * @param {Array<{role,content}>} params.historyMessages  From story-tree.getHistoryMessages()
 * @param {string} params.userInput   The user's current action/narration
 * @param {string} params.mode        'character' | 'narrator' | 'worldbuilder'
 * @param {object} params.activeChar  For labeling the user's action
 * @returns {Array<{role:string, content:string}>}
 */
export function buildMessages({ historyMessages, userInput, mode, activeChar }) {
  const messages = [...historyMessages];

  const prefix = mode === 'character'
    ? `[${activeChar?.name ?? 'Player'} acts]: `
    : mode === 'narrator'
    ? '[Narrator]: '
    : '[World]: ';

  messages.push({ role: 'user', content: prefix + userInput });
  return messages;
}

/**
 * Build the prompt for the new-story opening narration.
 * @param {object} params
 * @param {object} params.world
 * @param {object} params.location
 * @param {object} params.activeChar
 * @param {string} params.initialConflict
 * @returns {{ systemPrompt: string, messages: Array }}
 */
export function buildOpeningPrompt({ world, location, activeChar, initialConflict }) {
  const systemPrompt = buildSystemPrompt({
    world,
    location,
    activeChar,
    allChars: activeChar ? [activeChar] : [],
    mode: 'narrator'
  });

  const userContent = `Begin the story. Set the scene in ${location?.name ?? 'the opening location'}. Introduce ${activeChar?.name ?? 'the protagonist'} naturally in their environment.${initialConflict ? ` The story's central conflict involves: ${initialConflict}.` : ''} Write an immersive opening that draws the reader in immediately. End at a natural moment for the first player decision.`;

  return {
    systemPrompt,
    messages: [{ role: 'user', content: userContent }]
  };
}

/**
 * Build a prompt for location transition narration.
 * @param {object} params
 * @param {string} params.fromLocationName
 * @param {object} params.toLocation
 * @param {object} params.world
 * @param {object} params.activeChar
 * @returns {{ systemPrompt: string, messages: Array }}
 */
export function buildTransitionPrompt({ fromLocationName, toLocation, world, activeChar }) {
  const systemPrompt = buildSystemPrompt({
    world,
    location: toLocation,
    activeChar,
    allChars: [],
    mode: 'narrator'
  });

  const content = `Narrate the transition from ${fromLocationName} to ${toLocation?.name ?? 'the new location'}. Describe the journey briefly and establish the atmosphere of ${toLocation?.name}. End ready for the next player action.`;

  return {
    systemPrompt,
    messages: [{ role: 'user', content }]
  };
}

/**
 * Build a prompt for parallel arc narration (what's happening elsewhere).
 * @param {object} params
 * @param {string} params.arcName
 * @param {object} params.world
 * @param {object} params.location
 * @param {object} params.character   The character in this arc
 * @param {Array}  params.historyMessages
 * @param {string} params.userInput
 * @returns {{ systemPrompt: string, messages: Array }}
 */
export function buildArcPrompt({ arcName, world, location, character, allChars = [], historyMessages, userInput, mode = 'character' }) {
  const systemPrompt = buildSystemPrompt({
    world,
    location,
    activeChar: character,
    allChars,
    mode
  }) + `\n\n# Parallel Arc: ${arcName}\nThis is a separate storyline running simultaneously with the main narrative. Maintain its own continuity and tone.`;

  return {
    systemPrompt,
    messages: buildMessages({ historyMessages, userInput, mode, activeChar: character })
  };
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function _stateStr(stateObj) {
  if (!stateObj) return 'normal';
  return Object.entries(stateObj).map(([k, v]) => `${k}: ${v}`).join(', ');
}
