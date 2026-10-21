import { useCallback, useEffect, useState } from 'react';
import { api, assetUrl, errMsg } from '../api/client.js';
import { initTf, loadModel } from '../ml/classifier.js';

/** Fetches the active model_versions entry and loads its TF.js weights in the browser. */
export function useActiveModel() {
  const [state, setState] = useState({ status: 'loading', meta: null, model: null, backend: null, error: '' });

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, status: 'loading', error: '' }));
    try {
      const backend = await initTf();
      const { data } = await api.get('/models/active');
      if (!data.model) {
        setState({ status: 'none', meta: null, model: null, backend, error: '' });
        return;
      }
      const model = await loadModel(assetUrl(data.model.modelUrl));
      setState({ status: 'ready', meta: data.model, model, backend, error: '' });
    } catch (err) {
      setState({ status: 'error', meta: null, model: null, backend: null, error: errMsg(err, 'Failed to load model') });
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  return { ...state, refresh };
}
