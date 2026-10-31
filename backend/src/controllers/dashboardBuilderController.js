import { query } from '../config/db.js';
import dashboardEngine from '../services/dashboards/dashboardEngine.js';
import logger from '../utils/logger.js';

export async function listDashboards(req, res) {
  try {
    const dashboards = await query('SELECT * FROM ai_dashboards ORDER BY id DESC');
    return res.json({ success: true, dashboards });
  } catch (error) {
    logger.error('dashboards', 'Failed to list dashboards', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getDashboard(req, res) {
  const { id } = req.params;
  try {
    if (id === 'default' || id === '0') {
      const defaultDash = await dashboardEngine.getDefaultDashboard();
      return res.json({ success: true, dashboard: defaultDash });
    }

    const [dash] = await query('SELECT * FROM ai_dashboards WHERE id = ?', [id]);
    if (!dash) {
      return res.status(404).json({ success: false, error: 'Dashboard not found' });
    }

    const widgets = await query('SELECT * FROM ai_dashboard_widgets WHERE dashboard_id = ? ORDER BY id ASC', [id]);
    const computedWidgets = await Promise.all(
      widgets.map(async (w) => {
        const queryConfig = w.query_config_json ? JSON.parse(w.query_config_json) : {};
        const chartConfig = w.chart_config_json ? JSON.parse(w.chart_config_json) : {};
        const grid = w.grid_pos_json ? JSON.parse(w.grid_pos_json) : {};
        const data = await dashboardEngine.computeWidgetData(w.widget_type, queryConfig, dash.target_id);

        return {
          id: w.id,
          widgetType: w.widget_type,
          title: w.title,
          chartConfig,
          grid,
          data
        };
      })
    );

    return res.json({
      success: true,
      dashboard: {
        ...dash,
        widgets: computedWidgets
      }
    });
  } catch (error) {
    logger.error('dashboards', `Failed to get dashboard #${id}`, error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function generateDashboardWithAI(req, res) {
  const { prompt, targetContactId, provider = 'gemini', model = null } = req.body;
  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ success: false, error: 'A prompt instruction is required' });
  }

  try {
    const dashboard = await dashboardEngine.generateDashboardFromPrompt({
      prompt: prompt.trim(),
      targetContactId,
      provider,
      model
    });

    return res.status(201).json({
      success: true,
      dashboard
    });
  } catch (error) {
    logger.error('dashboards', 'AI Dashboard generation failed', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function deleteDashboard(req, res) {
  const { id } = req.params;
  try {
    await query('DELETE FROM ai_dashboard_widgets WHERE dashboard_id = ?', [id]);
    await query('DELETE FROM ai_dashboards WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Dashboard deleted' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export default {
  listDashboards,
  getDashboard,
  generateDashboardWithAI,
  deleteDashboard
};
