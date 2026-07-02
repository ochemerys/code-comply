/** Maps composable / Web Speech errors to inspector-friendly copy (M7-S14-B1). */
export function voiceInputErrorHelp(raw: string | undefined | null): {
  summary: string
  resolution: string
} {
  if (!raw?.trim()) {
    return {
      summary: 'Voice input did not complete.',
      resolution:
        'Press and hold the microphone, speak clearly, then release. You can type in the field instead.',
    }
  }
  const m = raw.toLowerCase()
  if (m.includes('not supported')) {
    return {
      summary: 'This browser does not support voice typing.',
      resolution:
        'Use the latest Chrome, Edge, or Safari, or type your note in the text field. Firefox and some private modes block speech recognition.',
    }
  }
  if (m.includes('offline')) {
    return {
      summary: 'Voice typing needs an internet connection.',
      resolution:
        'Connect to Wi‑Fi or mobile data and try again. The inspection app still works offline—you can type your description until you are back online.',
    }
  }
  if (m.includes('not-allowed')) {
    return {
      summary: 'The microphone is blocked for this site.',
      resolution:
        'Allow microphone access in your browser address bar or site settings, then try again. On shared tablets, an administrator may need to approve the permission.',
    }
  }
  if (m.includes('no-speech')) {
    return {
      summary: 'No speech was detected.',
      resolution:
        'Press and hold the mic while you speak, stay close to the device, and reduce background noise. Release when finished, or type instead.',
    }
  }
  if (m.includes('network')) {
    return {
      summary: 'Speech recognition could not reach the network service.',
      resolution:
        'Check your connection, wait a moment, and try again. If you are on a strict firewall or VPN, try another network or type your note.',
    }
  }
  if (m.includes('aborted')) {
    return {
      summary: 'Listening was interrupted.',
      resolution:
        'Press and hold the microphone while dictating, then release to insert text. Avoid tapping quickly—hold through your sentence.',
    }
  }
  if (m.includes('audio-capture')) {
    return {
      summary: 'No microphone could be found or it is in use.',
      resolution:
        'Plug in or enable a microphone, close other apps using the mic (including other browser tabs), then try again.',
    }
  }
  if (m.includes('service-not-allowed')) {
    return {
      summary: 'Voice typing is turned off by policy or settings.',
      resolution:
        'Check device or organization restrictions. You can still complete the form by typing.',
    }
  }
  if (m.includes('speech recognition error')) {
    return {
      summary: 'Speech recognition reported a problem.',
      resolution:
        'Try again with a steady hold on the button. If it keeps failing, type your note or restart the browser.',
    }
  }
  return {
    summary: 'Voice input could not be used.',
    resolution:
      'Try again, check your microphone and connection, or type your note in the field. If the problem continues, use another browser or device.',
  }
}
