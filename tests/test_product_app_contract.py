from pathlib import Path
import json
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app"


class ProductAppContractTest(unittest.TestCase):
    def test_product_app_files_exist(self):
        for relative_path in [
            "app/index.html",
            "app/src/styles.css",
            "app/src/main.js",
            "app/src/state.js",
            "app/src/viewModel.js",
            "app/src/world.js",
            "app/src/instruments.js",
            "app/src/commands.js",
            "app/src/reviewDraft.js",
            "vite.config.js",
            "package.json",
        ]:
            self.assertTrue((ROOT / relative_path).exists(), f"{relative_path} must exist")

    def test_product_app_is_separate_from_command_center(self):
        product = (APP / "index.html").read_text()
        self.assertIn("Groundplane", product)
        self.assertIn('id="product-app"', product)
        self.assertNotIn("AIOS Command Board", product)
        self.assertNotIn('id="app"', product)

    def test_product_app_has_file_open_guard(self):
        product = (APP / "index.html").read_text()
        self.assertIn('window.location.protocol !== "file:"', product)
        self.assertIn("file-open-guard-panel", product)
        self.assertIn("Do not open app/index.html directly", product)
        self.assertIn("http://127.0.0.1:5175/app/", product)
        self.assertIn("npm run app:local", product)
        self.assertLess(product.index("file-open-guard-panel"), product.index('rel="stylesheet"'))

    def test_stable_local_runtime_contract_is_documented_and_checkable(self):
        package = json.loads((ROOT / "package.json").read_text())
        scripts = package["scripts"]
        self.assertEqual(scripts["app:local"], "vite --host 127.0.0.1 --port 5175 --strictPort")
        self.assertEqual(scripts["app:local:check"], "node scripts/check-product-app.mjs")

        check_script = (ROOT / "scripts" / "check-product-app.mjs").read_text()
        self.assertIn("http://127.0.0.1:5175/app/", check_script)
        self.assertIn("npm run app:local", check_script)
        self.assertIn("product app ok", check_script)

        readme = (ROOT / "README.md").read_text()
        self.assertIn("npm run app:local", readme)
        self.assertIn("npm run app:local:check", readme)
        self.assertIn("http://127.0.0.1:5175/app/", readme)

    def test_product_app_has_living_atrium_regions(self):
        html = (APP / "index.html").read_text()
        for selector in [
            "product-app",
            "world-root",
            "world-orientation",
            "left-nav",
            "atlas-home",
            "command-bar",
            "inspector",
            "bottom-instruments",
            "current-block",
        ]:
            self.assertIn(f'id="{selector}"', html)
        for removed_selector in [
            "guide-toggle",
            "guide-panel",
            "guide-close",
            "recenter-world",
        ]:
            self.assertNotIn(f'id="{removed_selector}"', html)
        self.assertNotIn('class="terrain-compass"', html)

    def test_state_loader_scaffold_declares_repo_local_state_paths(self):
        state_js = (APP / "src" / "state.js").read_text()
        for path in [
            "/state/board.json",
            "/state/projects.json",
            "/state/tasks.json",
            "/state/routines.json",
            "/state/decisions.json",
            "/reviews/queue.json",
            "/wiki/memory-claims.json",
            "/sources/catalog.json",
            "/indexes/relationship-graph.json",
        ]:
            self.assertIn(path, state_js)
        self.assertIn("relationshipGraph", state_js)

    def test_world_and_instrument_scaffolds_expose_expected_exports(self):
        world_js = (APP / "src" / "world.js").read_text()
        instruments_js = (APP / "src" / "instruments.js").read_text()
        self.assertIn('from "three"', world_js)
        self.assertIn("createWorldScene", world_js)
        self.assertIn("buildWorldNodes", world_js)
        self.assertIn("buildWorldLinks", world_js)
        self.assertIn("setFocusState", world_js)
        self.assertIn("renderInspector", instruments_js)
        self.assertIn("renderInstruments", instruments_js)
        self.assertIn("relationship-list", instruments_js)
        self.assertIn("currentBlockAccessibleText", instruments_js)
        self.assertIn("data-relationship-id", instruments_js)
        self.assertIn("permissionMode", instruments_js)
        self.assertIn("renderEvidenceTrail", instruments_js)
        self.assertIn("renderSafeActions", instruments_js)
        self.assertIn("renderReviewDraftPreview", instruments_js)
        self.assertIn("renderApprovalQueueRail", instruments_js)
        self.assertIn("renderDistrictFocusSummary", instruments_js)
        self.assertIn("district-focus-summary", instruments_js)
        self.assertIn("data-inspector-scope", instruments_js)
        self.assertIn("review-draft-preview", instruments_js)
        self.assertIn("approval-queue-rail", instruments_js)
        self.assertIn("data-review-id", instruments_js)
        self.assertIn("data-action-route-id", instruments_js)
        self.assertIn("evidence-trail-head", instruments_js)
        self.assertIn("evidence-note-detail", instruments_js)
        self.assertIn("buildReviewDraftPreview", (APP / "src" / "reviewDraft.js").read_text())

    def test_visual_language_is_reference_aligned(self):
        css = (APP / "src" / "styles.css").read_text()
        for value in [
            "--graphite",
            "--terrain-gold",
            "--region-teal",
            "--region-violet",
            "prefers-reduced-motion",
            "backdrop-filter",
            "world-root",
        ]:
            self.assertIn(value, css)
        for value in [
            'data-label-role="selected"',
            'data-label-role="related"',
            "world-label[data-label-role",
            ".command-result span",
            ".command-result strong",
            ".command-result small",
            ".relationship-button",
            ".evidence-trail",
            ".evidence-trail-head",
            ".evidence-note-detail",
            ".source-list",
            ".safe-actions",
            ".action-route-button",
            ".review-draft-preview",
            ".approval-queue-rail",
            ".approval-queue-card",
            ".district-focus-summary",
            ".district-summary-grid",
            ".district-type-row",
            ".assistant-brief",
            ".brain-assistant-panel",
            ".brain-assistant-grid",
            ".brain-assistant-section",
            ".assistant-roadmap",
            ".assistant-roadmap-card",
            ".assistant-spine-mini",
            ".command-deck",
            ".command-deck-primary",
            ".command-deck-drawer",
            ".mission-control-panel",
            ".atlas-rail",
            "color-mix",
        ]:
            self.assertIn(value, css + (APP / "src" / "instruments.js").read_text())

    def test_desktop_cockpit_uses_progressive_disclosure(self):
        index_html = (APP / "index.html").read_text()
        self.assertIn('id="toggle-inspector"', index_html)
        self.assertIn('data-inspector-state="collapsed"', index_html)
        self.assertIn('aria-label="Show Details"', index_html)
        self.assertIn('title="Show Details"', index_html)
        self.assertIn('aria-pressed="false"', index_html)
        self.assertIn('data-toggle-state="idle"', index_html)
        self.assertIn('class="icon-button deck-toggle-button"', index_html)
        self.assertIn('class="deck-toggle-label">Details</span>', index_html)

        main = (APP / "src" / "main.js").read_text()
        self.assertIn('inspectorToggle: document.querySelector("#toggle-inspector")', main)
        self.assertIn("let inspectorCollapsed = true", main)
        self.assertIn("function syncInspectorVisibility", main)
        self.assertIn('inspectorCollapsed ? "false" : "true"', main)
        self.assertIn('inspectorCollapsed ? "idle" : "pressed"', main)
        self.assertIn('elements.inspectorToggle?.addEventListener("click"', main)

        instruments = (APP / "src" / "instruments.js").read_text()
        self.assertIn("renderCommandDeck", instruments)
        self.assertIn("command-deck-primary", instruments)
        self.assertIn("<details", instruments)
        self.assertIn("data-cockpit-scope", instruments)
        self.assertIn("data-drawer-kind", instruments)

        css = (APP / "src" / "styles.css").read_text()
        self.assertRegex(css, r"\.product-shell\s*\{[\s\S]*grid-template-columns:\s*78px\s+minmax\(0,\s*1fr\)")
        self.assertNotRegex(css, r"\.product-shell\s*\{[\s\S]*grid-template-columns:[^;}]*minmax\(360px,\s*420px\)")
        self.assertRegex(css, r"\.inspector\s*\{[\s\S]*position:\s*absolute")
        self.assertRegex(css, r"\.inspector\s*\{[\s\S]*right:\s*18px")
        self.assertRegex(css, r"\.inspector\s*\{[\s\S]*bottom:\s*84px")
        self.assertRegex(css, r"\.world-navigation\s*\{[\s\S]*right:\s*calc\(min\(420px,\s*calc\(100vw - 120px\)\)\s*\+\s*30px\)")
        self.assertRegex(css, r"\.product-shell\[data-inspector-state=\"collapsed\"\] \.inspector\s*\{[\s\S]*display:\s*none")
        self.assertRegex(css, r"\.product-shell\[data-inspector-state=\"collapsed\"\] \.world-navigation\s*\{[\s\S]*right:\s*18px")
        self.assertIn(".deck-toggle-button", css)
        self.assertIn(".deck-toggle-label", css)
        self.assertIn('.icon-button[data-toggle-state="pressed"]', css)
        self.assertIn(".left-nav.atlas-rail", css)
        self.assertIn(".command-deck", css)
        self.assertIn(".command-deck-drawer", css)
        self.assertIn(".mission-control-panel", css)
        self.assertIn(".left-nav.atlas-rail:hover", css)
        self.assertIn(".left-nav.atlas-rail:focus-within", css)
        self.assertIn(".region-copy", css)
        self.assertRegex(css, r"\.region-copy\s*\{[\s\S]*display:\s*none")
        self.assertRegex(
            css,
            r"\.left-nav\.atlas-rail:hover \.region-copy,\s*\.left-nav\.atlas-rail:focus-within \.region-copy\s*\{[\s\S]*display:\s*grid",
        )

    def test_atlas_rail_resting_state_is_bounded(self):
        instruments = (APP / "src" / "instruments.js").read_text()
        self.assertIn("ATLAS_RAIL_REST_LIMIT", instruments)
        self.assertIn("const primaryRegions = regions.slice(0, ATLAS_RAIL_REST_LIMIT)", instruments)
        self.assertIn("selectedRegionItem", instruments)
        self.assertIn("primaryRegions.push(selectedRegionItem)", instruments)
        self.assertIn("const overflowRegions = regions.filter((region) => !primaryIds.has(region.id))", instruments)
        self.assertIn("railOverflowCount", instruments)
        self.assertIn("data-rail-overflow", instruments)
        self.assertIn("rail-more-detail", instruments)
        self.assertIn("rail-more-list", instruments)
        self.assertIn("More areas", instruments)
        self.assertIn("Start here", instruments)

        css = (APP / "src" / "styles.css").read_text()
        self.assertRegex(css, r"\.product-shell\s*\{[\s\S]*grid-template-columns:\s*78px\s+minmax\(0,\s*1fr\)")
        self.assertRegex(css, r"\.left-nav\s*\{[\s\S]*width:\s*78px")
        self.assertRegex(css, r"\.left-nav\.atlas-rail:hover,\s*\.left-nav\.atlas-rail:focus-within\s*\{[\s\S]*width:\s*min\(280px")
        self.assertRegex(css, r"\.brand-lockup > div:last-child\s*\{[\s\S]*display:\s*none")
        self.assertRegex(css, r"\.rail-section-label\s*\{[\s\S]*display:\s*none")
        self.assertRegex(css, r"\.rail-more-detail summary span\s*\{[\s\S]*display:\s*none")
        self.assertRegex(css, r"\.region-button\[data-rail-overflow=\"true\"\]\s*\{[\s\S]*display:\s*grid")
        self.assertIn(".rail-section", css)
        self.assertIn(".rail-section-label", css)
        self.assertIn(".rail-more-detail", css)
        self.assertIn(".rail-more-detail summary", css)
        self.assertIn(".rail-more-list", css)
        self.assertNotIn(".rail-overflow-hint", css)

    def test_atlas_rail_labels_are_single_line_and_tooltipped(self):
        instruments = (APP / "src" / "instruments.js").read_text()
        self.assertIn('aria-label="${escapeHtml(`Open ${regionTitle}. ${regionSubtitle}`)}"', instruments)
        self.assertIn("function publicTitle", instruments)
        self.assertIn(
            "const regionTitle = publicTitle(region.title || region.id || \"Untitled area\", \"Untitled area\")",
            instruments,
        )
        self.assertIn("const regionSubtitle = publicSubtitle(region)", instruments)
        self.assertIn("function railGlyph", instruments)
        self.assertIn("function railGlyphCandidate", instruments)
        self.assertIn("const usedGlyphs = new Set()", instruments)
        self.assertIn("railGlyph(regionTitle, usedGlyphs)", instruments)
        self.assertIn("truncateText(regionTitle, 28)", instruments)
        self.assertIn("truncateText(regionSubtitle, 26)", instruments)

        css = (APP / "src" / "styles.css").read_text()
        self.assertRegex(css, r"\.region-copy strong\s*\{[\s\S]*text-overflow:\s*ellipsis")
        self.assertRegex(css, r"\.region-copy strong\s*\{[\s\S]*white-space:\s*nowrap")
        self.assertRegex(css, r"\.region-copy small\s*\{[\s\S]*text-overflow:\s*ellipsis")
        self.assertRegex(css, r"\.region-copy small\s*\{[\s\S]*white-space:\s*nowrap")

    def test_command_deck_has_decision_card_hierarchy(self):
        instruments = (APP / "src" / "instruments.js").read_text()
        self.assertIn("renderDecisionCard", instruments)
        self.assertIn('class="decision-card"', instruments)
        self.assertIn('class="decision-card-lede"', instruments)
        self.assertIn("decision-card-detail", instruments)
        self.assertIn("decision-card-context", instruments)
        self.assertIn("decision-card-action", instruments)
        self.assertIn('class="decision-card-meta"', instruments)
        self.assertIn("decisionCardModel", instruments)
        self.assertIn("plainDecisionTitle", instruments)
        self.assertIn("decisionSourceText", instruments)
        self.assertIn("Review cockpit feel", instruments)
        self.assertIn("renderAssistantBrief", instruments)
        self.assertIn("renderBrainAssistantBehavior", instruments)
        self.assertIn("assistant-brief", instruments)
        self.assertIn("brain-assistant-panel", instruments)
        self.assertIn("renderRoadmapCandidates", instruments)
        self.assertIn("assistant-roadmap", instruments)
        self.assertIn("Your move", instruments)
        self.assertIn("data-assistant-route", instruments)

        view_model = (APP / "src" / "viewModel.js").read_text()
        self.assertIn("assistantBrief", view_model)
        self.assertIn("brainAssistantBehavior", view_model)
        self.assertIn("buildRoadmapCandidates", view_model)
        self.assertIn("roadmapCandidates", view_model)
        self.assertIn("roadmap:", view_model)
        self.assertIn("buildAssistantBrief", view_model)
        self.assertIn("assistant:brief", view_model)
        self.assertIn("state/board.json operating_protocol.next_command", view_model)
        self.assertIn("Approve / revise / reject.", instruments)
        self.assertIn("Decision context", instruments)
        self.assertNotIn("<span>Decision needed</span>", instruments)
        self.assertIn("<span>Why</span>", instruments)
        self.assertIn("truncateText(nextActionDisplay, 34)", instruments)
        self.assertIn("card?.detail", instruments)

        css = (APP / "src" / "styles.css").read_text()
        self.assertIn(".decision-card", css)
        self.assertIn(".decision-card-lede", css)
        self.assertIn(".decision-card-detail", css)
        self.assertIn(".decision-card-context", css)
        self.assertIn(".decision-card-action", css)
        self.assertIn(".decision-card-meta", css)
        self.assertIn(".decision-card strong", css)
        self.assertRegex(css, r"\.decision-card\s*\{[\s\S]*padding:\s*8px")
        self.assertRegex(css, r"\.decision-card-action\s*\{[\s\S]*text-overflow:\s*ellipsis")
        self.assertRegex(css, r"\.decision-card-detail summary\s*\{[\s\S]*min-height:\s*28px")
        self.assertRegex(css, r"\.decision-card-detail:not\(\[open\]\) \.decision-card-context\s*\{[\s\S]*display:\s*none")

    def test_system_home_cockpit_is_first_class_read_only_surface(self):
        instruments = (APP / "src" / "instruments.js").read_text()
        view_model = (APP / "src" / "viewModel.js").read_text()
        css = (APP / "src" / "styles.css").read_text()

        self.assertIn("systemHomeCockpit", view_model)
        self.assertIn("buildSystemHomeCockpit", view_model)
        self.assertIn('id: "system-home-cockpit"', view_model)
        self.assertIn('browserWrites: false', view_model)
        self.assertIn("Today", view_model)
        self.assertIn("Projects", view_model)
        self.assertIn("Approvals", view_model)
        self.assertIn("Brain", view_model)
        self.assertIn("Routines", view_model)
        self.assertIn("Assistant", view_model)
        self.assertIn("renderSystemHomeCockpit", instruments)
        self.assertIn('class="system-home-cockpit"', instruments)
        self.assertIn("system-home-grid", instruments)
        self.assertIn("system-home-tile", instruments)
        self.assertIn("Next safe action", instruments)
        self.assertNotIn("renderSystemHomeCockpit(model?.systemHomeCockpit)", instruments)
        self.assertIn("renderSpatialCommandOverlay(elements?.spatialCommandOverlay", instruments)
        self.assertIn(".system-home-cockpit", css)
        self.assertIn(".system-home-grid", css)
        self.assertIn(".system-home-tile", css)
        self.assertRegex(css, r"\.system-home-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)")
        self.assertRegex(css, r"\.system-home-tile\s*\{[\s\S]*min-height:\s*86px")

    def test_today_command_surface_is_first_class_read_only_surface(self):
        instruments = (APP / "src" / "instruments.js").read_text()
        view_model = (APP / "src" / "viewModel.js").read_text()
        css = (APP / "src" / "styles.css").read_text()

        self.assertIn("todayCommandSurface", view_model)
        self.assertIn("buildTodayCommandSurface", view_model)
        self.assertIn('id: "today-command-surface"', view_model)
        self.assertIn('browserWrites: false', view_model)
        self.assertIn("Daily Ops Parked", view_model)
        self.assertIn("No Daily Operations restart", view_model)
        self.assertIn("renderTodayCommandSurface", instruments)
        self.assertIn('class="today-command-surface"', instruments)
        self.assertIn("today-command-grid", instruments)
        self.assertIn("today-command-card", instruments)
        self.assertIn("today-command-next", instruments)
        self.assertNotIn("renderTodayCommandSurface(model?.todayCommandSurface)", instruments)
        self.assertIn("renderSpatialCommandOverlay(elements?.spatialCommandOverlay", instruments)
        self.assertIn(".today-command-surface", css)
        self.assertIn(".today-command-grid", css)
        self.assertIn(".today-command-card", css)
        self.assertRegex(css, r"\.today-command-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)")
        self.assertRegex(css, r"\.command-deck:has\(\.command-deck-drawer\[open\]\) \.today-command-surface\s*\{[\s\S]*display:\s*none")

    def test_spatial_command_overlay_integrates_today_with_map(self):
        html = (APP / "index.html").read_text()
        main = (APP / "src" / "main.js").read_text()
        instruments = (APP / "src" / "instruments.js").read_text()
        view_model = (APP / "src" / "viewModel.js").read_text()
        css = (APP / "src" / "styles.css").read_text()

        self.assertIn('id="spatial-command-overlay"', html)
        self.assertLess(html.index('id="world-root"'), html.index('id="spatial-command-overlay"'))
        self.assertLess(html.index('id="spatial-command-overlay"'), html.index('class="world-navigation"'))
        self.assertIn('spatialCommandOverlay: document.querySelector("#spatial-command-overlay")', main)
        self.assertIn("spatialCommandOverlay", view_model)
        self.assertIn("buildSpatialCommandOverlay", view_model)
        self.assertIn('id: "spatial-command-overlay"', view_model)
        self.assertIn("renderSpatialCommandOverlay", instruments)
        self.assertIn("renderSpatialCommandOverlay(elements?.spatialCommandOverlay", instruments)
        self.assertIn(".spatial-command-overlay", css)
        self.assertIn(".spatial-command-card", css)
        self.assertIn(".spatial-command-route", css)
        self.assertRegex(css, r"\.spatial-command-overlay\s*\{[\s\S]*position:\s*absolute")
        self.assertRegex(css, r"\.spatial-command-overlay\s*\{[\s\S]*pointer-events:\s*auto")
        self.assertRegex(css, r"\.spatial-command-overlay\s*\{[\s\S]*bottom:\s*76px")
        self.assertRegex(css, r"\.spatial-command-card\s*\{[\s\S]*max-height:\s*56px")
        self.assertRegex(css, r"\.spatial-command-grid\s*\{[\s\S]*display:\s*none")
        self.assertIn(".spatial-command-card:hover .spatial-command-grid", css)
        self.assertIn(".spatial-command-card:focus-within .spatial-command-grid", css)

    def test_spatial_layout_v2_keeps_resting_chrome_intent_revealed(self):
        html = (APP / "index.html").read_text()
        css = (APP / "src" / "styles.css").read_text()

        self.assertIn('class="atlas-home-label"', html)
        self.assertIn('aria-label="Primary command controls"', html)
        self.assertNotIn('id="guide-toggle"', html)
        self.assertNotIn('id="recenter-world"', html)
        self.assertNotIn('class="terrain-compass"', html)
        self.assertRegex(css, r"\.top-command\s*\{[\s\S]*min-height:\s*52px")
        self.assertRegex(css, r"\.top-command\s*\{[\s\S]*grid-template-columns:\s*auto\s+auto\s+minmax\(42px")
        self.assertRegex(css, r"\.command-bar\s*\{[\s\S]*width:\s*42px")
        self.assertRegex(css, r"\.top-command:hover \.command-bar,\s*\.top-command:focus-within \.command-bar")
        self.assertRegex(css, r"\.atlas-home-label\s*\{[\s\S]*display:\s*none")
        self.assertRegex(css, r"\.deck-toggle-label\s*\{[\s\S]*display:\s*none")
        self.assertRegex(css, r"\.system-pulse\s*\{[\s\S]*width:\s*0")
        self.assertRegex(css, r"\.top-command:hover \.system-pulse,\s*\.top-command:focus-within \.system-pulse")
        self.assertRegex(css, r"\.world-navigation\s*\{[\s\S]*opacity:\s*0\.24")

    def test_world_focus_card_is_compact_beacon(self):
        main = (APP / "src" / "main.js").read_text()
        self.assertIn("function compactFocusText", main)
        self.assertIn("function focusBeaconDetailText", main)
        self.assertIn('region?.type === "district"', main)
        self.assertIn("compactFocusText(detailText, 34)", main)
        self.assertIn("elements.focusCard.title = focusLabel", main)
        self.assertIn('elements.focusCard.setAttribute("aria-label", focusLabel)', main)

        css = (APP / "src" / "styles.css").read_text()
        self.assertRegex(css, r"\.focus-card\s*\{[\s\S]*width:\s*min\(280px")
        self.assertRegex(css, r"\.focus-card\s*\{[\s\S]*padding:\s*8px\s+10px")
        self.assertRegex(css, r"\.focus-card strong\s*\{[\s\S]*font-size:\s*0\.86rem")
        self.assertRegex(css, r"\.focus-card span\s*\{[\s\S]*font-size:\s*0\.72rem")

    def test_command_deck_default_state_is_compact(self):
        instruments = (APP / "src" / "instruments.js").read_text()
        self.assertIn('class="command-deck-header"', instruments)
        self.assertIn("command-deck-status", instruments)
        self.assertIn('data-command-priority="primary"', instruments)
        self.assertIn("function conciseNextAction", instruments)
        self.assertIn("function recommendedActionLabel", instruments)
        self.assertIn("const actionCounts = String(action || \"\").match", instruments)
        self.assertIn('actionCounts[0].toLowerCase().includes("no source-backed")', instruments)
        self.assertIn("parsedRelationshipCount", instruments)
        self.assertIn('publicCountLabel(parsedRelationshipCount, "connection")', instruments)
        self.assertIn("const nextActionDisplay = conciseNextAction(nextActionText, region, hasBlockingDecision, safeActions)", instruments)
        self.assertIn("Context: ${publicText(nextActionText)}", instruments)
        self.assertIn('class="cockpit-brief command-line-brief"', instruments)
        self.assertIn("command-metrics-detail", instruments)
        self.assertIn("function commandPriorityMetric", instruments)
        self.assertIn("function drawerCountLabel", instruments)
        self.assertIn("function approvalDrawerMeta", instruments)
        self.assertIn("const priorityMetric = commandPriorityMetric", instruments)
        self.assertIn("<span>Status</span>", instruments)
        self.assertIn("${escapeHtml(priorityMetric)}", instruments)
        self.assertIn('drawerCountLabel(sourceCount, "source")', instruments)
        self.assertIn("approvalDrawerMeta(pendingReviews.length, resolvedReviews.length)", instruments)
        self.assertNotIn("const metricSummary = `${activeTasks.length}S", instruments)
        self.assertIn("truncateText(nextActionDisplay, 34)", instruments)
        self.assertNotIn("Continue with local polish or inspect", instruments)

        css = (APP / "src" / "styles.css").read_text()
        self.assertIn(".command-deck-header", css)
        self.assertRegex(css, r"\.cockpit-brief\s*\{[\s\S]*display:\s*flex")
        self.assertRegex(css, r"\.cockpit-brief\s*\{[\s\S]*white-space:\s*nowrap")
        self.assertRegex(css, r"\.cockpit-brief strong\s*\{[\s\S]*text-overflow:\s*ellipsis")
        self.assertRegex(css, r"\.command-metrics-detail:not\(\[open\]\) \.cockpit-metrics\s*\{[\s\S]*display:\s*none")
        self.assertRegex(css, r"\.command-deck-drawers\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)")
        self.assertRegex(css, r"\.command-deck-drawer\[open\]\s*\{[\s\S]*grid-column:\s*1\s*/\s*-1")
        self.assertIn(".command-deck-primary .pill-row", css)
        self.assertIn("max-height: 280px", css)

    def test_area_detail_system_has_compact_brief_before_drawers(self):
        instruments = (APP / "src" / "instruments.js").read_text()
        self.assertIn("function areaBriefModel", instruments)
        self.assertIn("function renderAreaBrief", instruments)
        self.assertIn('class="area-brief"', instruments)
        self.assertIn('class="area-brief-grid"', instruments)
        self.assertIn('class="area-brief-next"', instruments)
        self.assertIn('class="area-brief-links"', instruments)
        self.assertIn("What this is", instruments)
        self.assertIn("Next", instruments)
        self.assertIn("Signals", instruments)
        self.assertIn("Connections", instruments)
        self.assertIn("renderAreaBrief(areaBrief)", instruments)
        self.assertLess(instruments.index("renderAreaBrief(areaBrief)"), instruments.index('class="command-deck-drawers"'))
        self.assertNotIn("source-backed local relationships", instruments)

        css = (APP / "src" / "styles.css").read_text()
        self.assertIn(".area-brief", css)
        self.assertIn(".area-brief-grid", css)
        self.assertIn(".area-brief-next", css)
        self.assertIn(".area-brief-links", css)
        self.assertRegex(css, r"\.area-brief\s*\{[\s\S]*display:\s*grid")
        self.assertRegex(css, r"\.area-brief-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)")
        self.assertRegex(css, r"\.area-brief-next\s*\{[\s\S]*overflow:\s*hidden")
        self.assertRegex(css, r"\.area-brief-links\s*\{[\s\S]*white-space:\s*nowrap")
        self.assertRegex(css, r"\.area-brief-purpose span\s*\{[\s\S]*-webkit-line-clamp:\s*2")
        self.assertRegex(css, r"\.command-deck:has\(\.command-deck-drawer\[open\]\) \.area-brief\s*\{[\s\S]*display:\s*none")

    def test_project_workspace_has_first_real_project_surface(self):
        view_model = (APP / "src" / "viewModel.js").read_text()
        self.assertIn("function buildProjectWorkspaces", view_model)
        self.assertIn("workspace:PROJ-001", view_model)
        self.assertIn("projectWorkspace", view_model)
        self.assertIn("projectWorkspaces", view_model)
        self.assertIn("contextUsageLoop", view_model)
        self.assertIn("projectContextUsageLoop", view_model)
        self.assertIn("No Flagship Project writes", view_model)
        self.assertIn("No browser writes", view_model)
        self.assertIn("read-only project workspace", view_model)
        self.assertIn("No additional source reads", view_model)

        instruments = (APP / "src" / "instruments.js").read_text()
        self.assertIn("function renderProjectWorkspacePanel", instruments)
        self.assertIn("function renderProjectContextUsageLoop", instruments)
        self.assertIn('class="project-workspace-panel"', instruments)
        self.assertIn('class="project-context-usage-loop"', instruments)
        self.assertIn('class="project-workspace-grid"', instruments)
        self.assertIn('class="project-workspace-list"', instruments)
        self.assertIn('class="project-workspace-proof"', instruments)
        self.assertIn("Context usage loop", instruments)
        self.assertIn("Daily loop", instruments)
        self.assertIn("Project review prompts", instruments)
        self.assertIn("Next safe action", instruments)
        self.assertIn("Project workspace", instruments)
        self.assertIn("Next actions", instruments)
        self.assertIn("Linked proof", instruments)
        self.assertIn("renderProjectContextUsageLoop(workspace.contextUsageLoop)", instruments)
        self.assertIn("renderProjectWorkspacePanel(region.projectWorkspace)", instruments)
        self.assertLess(instruments.index("renderProjectWorkspacePanel(region.projectWorkspace)"), instruments.index('class="command-deck-drawers"'))

        css = (APP / "src" / "styles.css").read_text()
        self.assertIn(".project-workspace-panel", css)
        self.assertIn(".project-context-usage-loop", css)
        self.assertIn(".project-context-usage-grid", css)
        self.assertIn(".project-context-next", css)
        self.assertIn(".project-workspace-grid", css)
        self.assertIn(".project-workspace-list", css)
        self.assertIn(".project-workspace-proof", css)
        self.assertRegex(css, r"\.project-workspace-panel\s*\{[\s\S]*display:\s*grid")
        self.assertRegex(css, r"\.project-context-usage-loop\s*\{[\s\S]*display:\s*grid")
        self.assertRegex(css, r"\.project-context-usage-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)")
        self.assertRegex(css, r"\.project-workspace-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)")
        self.assertRegex(css, r"\.project-workspace-list li\s*\{[\s\S]*display:\s*grid")
        self.assertRegex(css, r"\.command-deck:has\(\.command-deck-drawer\[open\]\) \.project-workspace-panel\s*\{[\s\S]*display:\s*none")

    def test_district_focus_summary_is_collapsed_first(self):
        instruments = (APP / "src" / "instruments.js").read_text()
        self.assertIn("function districtSummaryBrief", instruments)
        self.assertIn("function districtSummaryLabel", instruments)
        self.assertIn('class="district-focus-head"', instruments)
        self.assertIn('class="district-focus-brief"', instruments)
        self.assertIn("district-summary-detail", instruments)
        self.assertIn("district-summary-detail-body", instruments)
        self.assertIn('title="${escapeHtml(fullSummary)}"', instruments)
        self.assertIn('aria-label="${escapeHtml(districtSummaryLabel(summary, fullSummary))}"', instruments)
        self.assertIn("districtSummaryBrief(summary)", instruments)
        self.assertIn("truncateText(briefText, 54)", instruments)
        self.assertIn("Area details", instruments)
        self.assertIn("summary.summary || \"No area summary available.\"", instruments)
        self.assertNotIn('<p>${escapeHtml(summary.summary || "No district summary available.")}</p>', instruments)

        css = (APP / "src" / "styles.css").read_text()
        self.assertIn(".district-focus-head", css)
        self.assertIn(".district-focus-brief", css)
        self.assertIn(".district-summary-detail", css)
        self.assertIn(".district-summary-detail-body", css)
        self.assertRegex(css, r"\.district-focus-summary\s*\{[\s\S]*display:\s*grid")
        self.assertRegex(css, r"\.district-focus-brief\s*\{[\s\S]*white-space:\s*nowrap")
        self.assertRegex(css, r"\.district-summary-detail:not\(\[open\]\) \.district-summary-detail-body\s*\{[\s\S]*display:\s*none")

    def test_command_deck_is_decision_first(self):
        instruments = (APP / "src" / "instruments.js").read_text()
        self.assertIn(
            "const fullRegionTitle = publicTitle(region.title || region.id || \"Untitled focus\", \"Untitled focus\")",
            instruments,
        )
        self.assertIn("const compactRegionTitle = compactEntityTitle({ ...region, title: fullRegionTitle }, \"Untitled focus\")", instruments)
        self.assertIn("const deckTitle = hasBlockingDecision ? decisionCard.title || compactRegionTitle : compactRegionTitle", instruments)
        self.assertIn("const fullDeckTitle = hasBlockingDecision ? decisionCard.title || fullRegionTitle : fullRegionTitle", instruments)
        self.assertIn('const deckKicker = hasBlockingDecision ? "Review needed" : scopeLabel', instruments)
        self.assertIn('const deckContext = model?.assistantBrief ? "Map" : model?.activeDistrictId ? "Inside area" : "Map overview"', instruments)
        self.assertIn("function statusDot", instruments)
        self.assertIn("function isBlockingReview", instruments)
        self.assertIn("function firstBlockingReview", instruments)
        self.assertIn("const hasBlockingDecision = decisionCard.tone !== \"clear\"", instruments)
        self.assertIn("statusDot(region.status)", instruments)
        self.assertIn("statusDot(region.health)", instruments)
        self.assertIn("statusDot(scopeLabel)", instruments)
        self.assertIn("focus.nextAction || region.nextAction || decisionCard.action || \"No next action available\"", instruments)
        self.assertIn("const shouldShowDecisionCard = hasBlockingDecision", instruments)
        self.assertIn("<p class=\"section-kicker\">${escapeHtml(deckKicker)}</p>", instruments)
        self.assertIn('title="${escapeHtml(fullDeckTitle)}"', instruments)
        self.assertIn('aria-label="${escapeHtml(fullDeckTitle)}"', instruments)
        self.assertIn("truncateText(deckTitle, 42)", instruments)
        self.assertIn('class="command-deck-context"', instruments)
        self.assertIn("truncateText(deckContext, 40)", instruments)
        self.assertIn("const contextSummary = metaRows", instruments)
        self.assertIn("Decision context", instruments)
        self.assertIn("const showLedeState = !hideTitle", instruments)
        self.assertIn("shouldShowDecisionCard ? renderDecisionCard(decisionCard, { hideTitle: true }) : \"\"", instruments)
        self.assertNotIn("<p class=\"section-kicker\">Command deck</p>", instruments)
        self.assertNotIn("<h2>${escapeHtml(region.title || region.id || \"Untitled focus\")}</h2>", instruments)

        css = (APP / "src" / "styles.css").read_text()
        self.assertIn(".command-deck-context", css)
        self.assertRegex(css, r"\.command-deck-context\s*\{[\s\S]*max-width:\s*160px")
        self.assertRegex(css, r"\.command-deck-context\s*\{[\s\S]*text-overflow:\s*ellipsis")
        self.assertRegex(css, r"\.command-deck-primary h2\s*\{[\s\S]*font-size:\s*1\.04rem")
        self.assertRegex(css, r"\.command-deck-primary h2\s*\{[\s\S]*line-height:\s*1\.16")
        self.assertRegex(css, r"\.command-deck-status\s*\{[\s\S]*max-width:\s*118px")
        self.assertIn(".command-status-dot", css)
        self.assertRegex(css, r"\.command-deck-status \.status-pill\s*\{[\s\S]*font-size:\s*0")
        self.assertRegex(css, r"\.command-deck-status \.status-pill\s*\{[\s\S]*color:\s*transparent")

    def test_command_deck_compacts_sentence_like_entity_titles(self):
        instruments = (APP / "src" / "instruments.js").read_text()
        self.assertIn("function entityIdSuffix", instruments)
        self.assertIn("function isSentenceLikeText", instruments)
        self.assertIn("function compactEntityTitle", instruments)
        self.assertIn(
            "const fullRegionTitle = publicTitle(region.title || region.id || \"Untitled focus\", \"Untitled focus\")",
            instruments,
        )
        self.assertIn("const compactRegionTitle = compactEntityTitle({ ...region, title: fullRegionTitle }, \"Untitled focus\")", instruments)
        self.assertIn("const deckTitle = hasBlockingDecision ? decisionCard.title || compactRegionTitle : compactRegionTitle", instruments)
        self.assertIn("const fullDeckTitle = hasBlockingDecision ? decisionCard.title || fullRegionTitle : fullRegionTitle", instruments)
        self.assertIn('const deckContext = model?.assistantBrief ? "Map" : model?.activeDistrictId ? "Inside area" : "Map overview"', instruments)
        self.assertIn('title="${escapeHtml(fullDeckTitle)}"', instruments)
        self.assertIn('aria-label="${escapeHtml(fullDeckTitle)}"', instruments)
        self.assertIn("return `${type} ${suffix}`.trim()", instruments)

    def test_slug_like_titles_render_as_human_names(self):
        instruments = (APP / "src" / "instruments.js").read_text()
        main = (APP / "src" / "main.js").read_text()

        self.assertIn("function publicTitle", instruments)
        self.assertIn('replace(/[_-]+/g, " ")', instruments)
        self.assertIn("text.replace(/\\b[a-z]/g, (letter) => letter.toUpperCase())", instruments)
        self.assertIn("publicTitle(region.title || region.id || \"Untitled area\", \"Untitled area\")", instruments)
        self.assertIn("publicTitle(activeDistrict.title || activeDistrict.id || \"Area\", \"Area\")", instruments)
        self.assertIn("publicTitle(activeDistrict.title || activeDistrict.id || \"Area\", \"Area\")", instruments)
        self.assertIn("function publicUiTitle", main)
        self.assertIn('replace(/[_-]+/g, " ")', main)
        self.assertIn("publicUiTitle(region.title || region.id || \"Current focus\")", main)

    def test_compact_browser_width_keeps_atlas_rail_glyph_first(self):
        css = (APP / "src" / "styles.css").read_text()
        self.assertRegex(css, r"@media \(max-width:\s*980px\)[\s\S]*?\.left-nav\s*\{[\s\S]*width:\s*72px")
        self.assertRegex(
            css,
            r"@media \(max-width:\s*980px\)[\s\S]*?\.left-nav\.atlas-rail:hover,\s*\.left-nav\.atlas-rail:focus-within\s*\{[\s\S]*width:\s*min\(280px",
        )
        self.assertRegex(
            css,
            r"@media \(max-width:\s*980px\)[\s\S]*?\.left-nav\.atlas-rail:hover \.region-copy,\s*\.left-nav\.atlas-rail:focus-within \.region-copy\s*\{[\s\S]*display:\s*grid",
        )

    def test_compact_desktop_top_command_keeps_pulse_inline(self):
        css = (APP / "src" / "styles.css").read_text()
        self.assertRegex(
            css,
            r"@media \(max-width:\s*980px\)[\s\S]*?\.top-command\s*\{[\s\S]*grid-template-columns:\s*auto\s+auto\s+minmax\(0,\s*1fr\)\s+auto",
        )
        self.assertRegex(css, r"@media \(max-width:\s*980px\)[\s\S]*?\.system-pulse\s*\{[\s\S]*grid-column:\s*auto")
        self.assertRegex(css, r"@media \(max-width:\s*980px\)[\s\S]*?\.system-pulse\s*\{[\s\S]*max-width:\s*min\(212px")
        self.assertRegex(css, r"@media \(max-width:\s*980px\)[\s\S]*?\.system-pulse-chip\s*\{[\s\S]*min-width:\s*36px")
        self.assertRegex(css, r"@media \(max-width:\s*700px\)[\s\S]*?\.system-pulse\s*\{[\s\S]*grid-column:\s*1\s*/\s*-1")
        self.assertRegex(
            css,
            r"@media \(max-width:\s*460px\)[\s\S]*?\.top-command\s*\{[\s\S]*grid-template-columns:\s*auto\s+auto\s+minmax\(0,\s*1fr\)",
        )

    def test_shell_primary_controls_are_minimal_and_start_drives_next_steps(self):
        html = (APP / "index.html").read_text()
        main = (APP / "src" / "main.js").read_text()
        css = (APP / "src" / "styles.css").read_text()

        self.assertNotIn('id="guide-toggle"', html)
        self.assertNotIn('id="guide-panel"', html)
        self.assertNotIn('id="guide-close"', html)
        self.assertNotIn('id="recenter-world"', html)
        self.assertNotIn("How to use this app", html)
        self.assertNotIn("Home returns to the overview", html)
        self.assertNotIn('class="terrain-compass"', html)
        self.assertIn('aria-label="Start: open next steps"', html)
        self.assertIn('class="play-button-label">Start</span>', html)
        self.assertNotIn('guideToggle: document.querySelector("#guide-toggle")', main)
        self.assertNotIn('guideClose: document.querySelector("#guide-close")', main)
        self.assertNotIn('guidePanel: document.querySelector("#guide-panel")', main)
        self.assertNotIn('recenter: document.querySelector("#recenter-world")', main)
        self.assertIn('runCurrentBlock: document.querySelector("#run-current-block")', main)
        self.assertNotIn("function syncGuideVisibility", main)
        self.assertNotIn("function toggleGuide", main)
        self.assertIn("function startCurrentStep", main)
        self.assertIn('const actionsDrawer = elements.inspector?.querySelector("[data-drawer-kind=\\"actions\\"]")', main)
        self.assertIn('actionsDrawer?.setAttribute("open", "")', main)
        self.assertIn('elements.runCurrentBlock?.addEventListener("click", startCurrentStep)', main)
        self.assertNotIn('elements.guideToggle?.addEventListener("click", () => toggleGuide())', main)
        self.assertNotIn('elements.guideClose?.addEventListener("click", () => toggleGuide(false))', main)
        self.assertNotIn('if (event.key === "Escape" && guideOpen)', main)
        self.assertNotIn(".guide-panel", css)
        self.assertNotIn(".guide-steps", css)

    def test_command_deck_drawers_are_glanceable_disclosure_chips(self):
        instruments = (APP / "src" / "instruments.js").read_text()
        self.assertIn("function drawerLabel", instruments)
        self.assertIn('relationships: "Connections"', instruments)
        self.assertIn('sources: "Evidence"', instruments)
        self.assertIn('actions: "Next steps"', instruments)
        self.assertIn('approvals: "Reviews"', instruments)
        self.assertIn('system: "System"', instruments)
        self.assertIn('more: "Details"', instruments)
        self.assertIn("const drawerMeta = publicText(meta || \"Open\")", instruments)
        self.assertIn("const visibleTitle = drawerLabel(kind, title)", instruments)
        self.assertIn("const summaryLabel = `${visibleTitle}: ${drawerMeta}`", instruments)
        self.assertIn("truncateText(visibleTitle, 18)", instruments)
        self.assertIn('title="${escapeHtml(drawerMeta)}"', instruments)
        self.assertIn('aria-label="${escapeHtml(summaryLabel)}"', instruments)
        self.assertNotIn("drawerIcon(kind)", instruments)
        self.assertNotIn('class="drawer-sigil"', instruments)
        self.assertIn('class="drawer-copy"', instruments)
        self.assertIn('class="drawer-meta"', instruments)
        self.assertIn('class="drawer-state"', instruments)
        self.assertIn('const state = open ? "open" : "closed"', instruments)
        self.assertIn('data-drawer-state="${escapeHtml(state)}"', instruments)
        self.assertIn("<small class=\"drawer-meta\"", instruments)

        css = (APP / "src" / "styles.css").read_text()
        self.assertNotIn(".drawer-sigil", css)
        self.assertIn(".drawer-copy", css)
        self.assertIn(".drawer-state", css)
        self.assertRegex(css, r"\.command-deck-drawers\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)")
        self.assertRegex(css, r"\.command-deck-drawer summary\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto")
        self.assertRegex(css, r"\.command-deck-drawer summary\s*\{[\s\S]*min-height:\s*34px")
        self.assertRegex(css, r"\.command-deck-drawer summary\s*\{[\s\S]*box-shadow:\s*inset 2px 0 0 rgba\(214,\s*169,\s*104,\s*0\.32\)")
        self.assertRegex(css, r"\.drawer-copy small\s*\{[\s\S]*display:\s*block")
        self.assertRegex(css, r"\.command-deck-drawer:not\(\[open\]\) \.command-deck-drawer-body\s*\{[\s\S]*display:\s*none")

    def test_command_deck_groups_secondary_panels_behind_more(self):
        instruments = (APP / "src" / "instruments.js").read_text()
        self.assertIn("function secondaryCommandPanel", instruments)
        self.assertIn("const secondaryPanels = [", instruments)
        self.assertIn('secondaryCommandPanel("proof"', instruments)
        self.assertRegex(instruments, r"secondaryCommandPanel\(\s*\"relationships\"")
        self.assertRegex(instruments, r"secondaryCommandPanel\(\s*\"system\"")
        self.assertIn('drawer(\n          "more"', instruments)
        self.assertIn("secondary-command-stack", instruments)
        self.assertIn("secondary-command-detail", instruments)
        self.assertNotIn('drawer("proof"', instruments)
        self.assertNotIn('drawer(\n          "relationships"', instruments)
        self.assertNotIn('drawer(\n          "system"', instruments)

        css = (APP / "src" / "styles.css").read_text()
        self.assertIn(".secondary-command-stack", css)
        self.assertIn(".secondary-command-detail", css)
        self.assertIn(".secondary-command-body", css)
        self.assertRegex(css, r"\.secondary-command-detail:not\(\[open\]\) \.secondary-command-body\s*\{[\s\S]*display:\s*none")
        self.assertIn(".secondary-command-detail summary:hover", css)
        self.assertIn(".secondary-command-detail summary:focus-visible", css)

    def test_approval_drawer_uses_compact_history_disclosure(self):
        instruments = (APP / "src" / "instruments.js").read_text()
        self.assertIn("function approvalFlowModel", instruments)
        self.assertIn("function renderApprovalFlowPanel", instruments)
        self.assertIn("approval-flow-panel", instruments)
        self.assertIn("approval-flow-grid", instruments)
        self.assertIn("approval-flow-boundary", instruments)
        self.assertIn("Review decision", instruments)
        self.assertIn("Approve / Revise / Reject", instruments)
        self.assertIn("Queue only", instruments)
        self.assertIn("Browser writes", instruments)
        self.assertIn("Undo path", instruments)
        self.assertIn("approval-card-summary", instruments)
        self.assertIn("approval-card-signal", instruments)
        self.assertIn("const sourceSignal = `${sourceIds.length} src`", instruments)
        self.assertIn("const targetSignal = review.target_file || review.targetFile || \"no target\"", instruments)
        self.assertIn('title="${escapeHtml(`${reviewTitle}. ${diffSummary}`)}"', instruments)
        self.assertIn('aria-label="${escapeHtml(`${reviewTitle}. ${diffSummary}`)}"', instruments)
        self.assertIn("approval-metadata-detail", instruments)
        self.assertIn("approval-metadata-grid", instruments)
        self.assertIn("approval-card-detail", instruments)
        self.assertIn("approval-history-drawer", instruments)
        self.assertIn("approval-history-list", instruments)
        self.assertIn("Review metadata", instruments)
        self.assertIn("Decision copy", instruments)
        self.assertIn('<small title="${escapeHtml(decisionCopy)}">Open</small>', instruments)
        self.assertIn("Resolved outcomes", instruments)

        css = (APP / "src" / "styles.css").read_text()
        self.assertIn(".approval-flow-panel", css)
        self.assertIn(".approval-flow-grid", css)
        self.assertIn(".approval-flow-boundary", css)
        self.assertRegex(css, r"\.approval-flow-panel\s*\{[\s\S]*display:\s*grid")
        self.assertRegex(css, r"\.approval-flow-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)")
        self.assertIn(".approval-card-summary", css)
        self.assertIn(".approval-card-signal", css)
        self.assertIn(".approval-metadata-detail", css)
        self.assertIn(".approval-metadata-grid", css)
        self.assertIn(".approval-card-detail", css)
        self.assertIn(".approval-history-drawer", css)
        self.assertRegex(css, r"\.approval-metadata-detail:not\(\[open\]\) \.approval-metadata-grid\s*\{[\s\S]*display:\s*none")
        self.assertRegex(css, r"\.approval-history-drawer:not\(\[open\]\) \.approval-history-list\s*\{[\s\S]*display:\s*none")

    def test_proof_drawer_uses_compact_dossier_disclosure(self):
        instruments = (APP / "src" / "instruments.js").read_text()
        self.assertIn("proof-summary-strip", instruments)
        self.assertIn("proof-dossier-detail", instruments)
        self.assertIn("proof-dossier-body", instruments)
        self.assertIn("proof-detail-drawer", instruments)
        self.assertIn("proof-detail-body", instruments)
        self.assertIn("proof-capabilities-detail", instruments)
        self.assertIn("What is included", instruments)
        self.assertIn("proof-next-action-compact", instruments)
        self.assertIn("Local files", instruments)
        self.assertIn("What it proves", instruments)
        self.assertIn("Limitations", instruments)
        self.assertIn("Approval limit", instruments)
        self.assertNotIn('<p class="proof-section-label">Proven capabilities</p>', instruments)

        css = (APP / "src" / "styles.css").read_text()
        self.assertIn(".proof-summary-strip", css)
        self.assertIn(".proof-dossier-detail", css)
        self.assertIn(".proof-dossier-body", css)
        self.assertIn(".proof-detail-drawer", css)
        self.assertIn(".proof-next-action-compact", css)
        self.assertRegex(css, r"\.proof-detail-drawer:not\(\[open\]\) \.proof-detail-body\s*\{[\s\S]*display:\s*none")

    def test_proof_launcher_is_read_only_and_actionable(self):
        view_model = (APP / "src" / "viewModel.js").read_text()
        instruments = (APP / "src" / "instruments.js").read_text()
        main = (APP / "src" / "main.js").read_text()
        css = (APP / "src" / "styles.css").read_text()

        self.assertIn("function proofLauncherModel", view_model)
        self.assertIn("function shellQuote", view_model)
        self.assertIn("proofLauncher", view_model)
        self.assertIn("launcherRouteId", view_model)
        self.assertIn('command(artifact.launcherRouteId, `Open ${artifact.title}`, "proof-launcher"', view_model)
        self.assertIn("function renderProofLauncherPanel", instruments)
        self.assertIn("proof-launcher-panel", instruments)
        self.assertIn("proof-launcher-actions", instruments)
        self.assertIn("Review package", instruments)
        self.assertIn("Local demo", instruments)
        self.assertIn("Copy command", instruments)
        self.assertIn("Read-only launcher", instruments)
        self.assertIn("No writes from browser", instruments)
        self.assertIn("launchProofArtifact", main)
        self.assertIn('routeId.startsWith("proof-launcher:")', main)
        self.assertIn("activeProofLauncherId", main)
        self.assertIn("function syncProofLauncherState", main)
        self.assertIn('data-proof-launcher-id', main)
        self.assertNotIn("window.open(", main)
        self.assertNotIn("navigator.clipboard.writeText", main)
        self.assertIn(".proof-launcher-panel", css)
        self.assertIn(".proof-launcher-actions", css)
        self.assertRegex(css, r"\.proof-launcher-actions\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)")
        self.assertRegex(css, r"\.proof-launcher-action code\s*\{[\s\S]*white-space:\s*pre-wrap")
        self.assertRegex(css, r"\.proof-launcher-action code\s*\{[\s\S]*overflow-wrap:\s*anywhere")

    def test_action_drawer_uses_compact_route_disclosure(self):
        instruments = (APP / "src" / "instruments.js").read_text()
        self.assertIn("function actionFlowModel", instruments)
        self.assertIn("function renderActionFlowPanel", instruments)
        self.assertIn("action-flow-panel", instruments)
        self.assertIn("action-flow-grid", instruments)
        self.assertIn("action-flow-boundary", instruments)
        self.assertIn("Can do now", instruments)
        self.assertIn("Needs approval", instruments)
        self.assertIn("Browser writes", instruments)
        self.assertIn("Undo path", instruments)
        self.assertIn("function compactActionGate", instruments)
        self.assertIn("function compactActionMode", instruments)
        self.assertIn("function actionDetailMeta", instruments)
        self.assertIn("function renderActionRoute", instruments)
        self.assertIn("const visibleActions = actions.slice(0, 2)", instruments)
        self.assertIn("const overflowActions = actions.slice(2)", instruments)
        self.assertIn("action-route-card", instruments)
        self.assertIn("action-route-summary", instruments)
        self.assertIn("action-route-detail", instruments)
        self.assertIn("action-overflow-detail", instruments)
        self.assertIn("More steps", instruments)
        self.assertIn("${visibleActions.map(renderActionRoute).join(\"\")}", instruments)
        self.assertIn("${overflowActions.map(renderActionRoute).join(\"\")}", instruments)
        self.assertIn("Open step details", instruments)
        self.assertIn("data-action-route-id", instruments)
        self.assertIn('return "Needs approval"', instruments)
        self.assertIn('return "Ready"', instruments)
        self.assertIn('"automatic-low-risk": "Automatic"', instruments)
        self.assertIn('"draft-for-approval": "Draft for review"', instruments)
        self.assertIn('"suggest-only": "Suggestion"', instruments)
        self.assertIn('"low": "Low risk"', instruments)
        self.assertIn('"medium": "Medium risk"', instruments)
        self.assertIn('"high": "High risk"', instruments)
        self.assertIn('return details.length > 0 ? details.join(" / ") : "No file write"', instruments)
        self.assertNotIn('return action.requiresExplicitApproval ? "Gate" : "Free"', instruments)
        self.assertNotIn('"automatic-low-risk": "auto"', instruments)
        self.assertNotIn('"draft-for-approval": "approval"', instruments)
        self.assertNotIn('"suggest-only": "suggest"', instruments)
        self.assertNotIn('Target: none', instruments)
        self.assertNotIn('Evidence: none', instruments)

        css = (APP / "src" / "styles.css").read_text()
        self.assertIn(".action-flow-panel", css)
        self.assertIn(".action-flow-grid", css)
        self.assertIn(".action-flow-boundary", css)
        self.assertRegex(css, r"\.action-flow-panel\s*\{[\s\S]*display:\s*grid")
        self.assertRegex(css, r"\.action-flow-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)")
        self.assertIn(".action-route-card", css)
        self.assertIn(".action-route-summary", css)
        self.assertIn(".action-route-detail", css)
        self.assertIn(".action-overflow-detail", css)
        self.assertIn(".action-route-overflow-list", css)
        self.assertRegex(css, r"\.action-route-card:not\(\[open\]\) \.action-route-detail\s*\{[\s\S]*display:\s*none")
        self.assertRegex(css, r"\.action-overflow-detail:not\(\[open\]\) \.action-route-overflow-list\s*\{[\s\S]*display:\s*none")

    def test_connection_details_use_plain_labels(self):
        instruments = (APP / "src" / "instruments.js").read_text()
        self.assertIn("function connectionLensModel", instruments)
        self.assertIn("function renderConnectionLens", instruments)
        self.assertIn("connection-lens-panel", instruments)
        self.assertIn("connection-lens-grid", instruments)
        self.assertIn("connection-path-preview", instruments)
        self.assertIn("Related paths", instruments)
        self.assertIn("Why it matters", instruments)
        self.assertIn("Safe next step", instruments)
        self.assertIn("Source count", instruments)
        self.assertIn("function readablePermissionMode", instruments)
        self.assertIn("function relationshipPathTitle", instruments)
        self.assertIn("function relationshipKindLabel", instruments)
        self.assertIn("function relationshipStrengthLabel", instruments)
        self.assertIn('"automatic-low-risk": "Automatic low risk"', instruments)
        self.assertIn('"draft-for-approval": "Draft for review"', instruments)
        self.assertIn('"suggest-only": "Suggestion only"', instruments)
        self.assertIn('if (relationship.visualOnly) return "Map-only cue"', instruments)
        self.assertIn('if (!Number.isFinite(relationship.strength)) return "Strength not scored"', instruments)
        self.assertIn("const pathTitle = relationshipPathTitle(fromTitle, toTitle)", instruments)
        self.assertIn("<h3>${escapeHtml(pathTitle)}</h3>", instruments)
        self.assertIn("relationshipKindLabel(relationship)", instruments)
        self.assertNotIn('const strength = Number.isFinite(relationship.strength) ? `${Math.round(relationship.strength * 100)}% strength` : "unweighted"', instruments)
        self.assertNotIn('const permission = relationship.visualOnly ? "visual gravity"', instruments)

        css = (APP / "src" / "styles.css").read_text()
        self.assertIn(".connection-lens-panel", css)
        self.assertIn(".connection-lens-grid", css)
        self.assertIn(".connection-path-preview", css)
        self.assertRegex(css, r"\.connection-lens-panel\s*\{[\s\S]*display:\s*grid")
        self.assertRegex(css, r"\.connection-lens-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)")
        self.assertRegex(css, r"\.connection-path-preview\s*\{[\s\S]*max-height:")

    def test_source_drawer_uses_compact_record_disclosure(self):
        instruments = (APP / "src" / "instruments.js").read_text()
        self.assertIn("function compactEvidenceSignal", instruments)
        self.assertIn("evidence-trail-head", instruments)
        self.assertIn("evidence-note-detail", instruments)
        self.assertIn("const fullEvidenceSignal", instruments)
        self.assertIn("source-records-detail", instruments)
        self.assertIn("source-record-list", instruments)
        self.assertIn("<span>Source files</span>", instruments)
        self.assertIn("<small title=\"${escapeHtml(summaryText)}\">Open</small>", instruments)

        css = (APP / "src" / "styles.css").read_text()
        self.assertIn(".evidence-trail-head", css)
        self.assertIn(".evidence-note-detail", css)
        self.assertIn(".source-records-detail", css)
        self.assertIn(".source-record-list", css)
        self.assertIn(".evidence-note-detail:not([open]) p,", css)
        self.assertRegex(css, r"\.source-records-detail:not\(\[open\]\) \.source-record-list\s*\{[\s\S]*display:\s*none")

    def test_top_command_uses_scan_friendly_signal_chips(self):
        instruments = (APP / "src" / "instruments.js").read_text()
        self.assertIn("renderSystemPulse", instruments)
        self.assertIn("systemPulseItems", instruments)
        self.assertIn("function decisionPulseItems", instruments)
        self.assertIn('class="system-pulse-chip"', instruments)
        self.assertIn('pulseLabel(signalCount, "Task")', instruments)
        self.assertIn('pulseLabel(approvalCount, "Approval")', instruments)
        self.assertIn('pulseLabel(outcomeCount, "Outcome")', instruments)
        self.assertIn('pulseLabel(regionCount, "Area")', instruments)
        self.assertIn('kind === "approvals"', instruments)
        self.assertIn('return [["clear", "Clear", 0]]', instruments)
        self.assertIn("function pulseDisplayLabel", instruments)
        self.assertIn("const fullLabel = pulseDisplayLabel(label, value)", instruments)
        self.assertIn("const visibleItems = decisionPulseItems(items)", instruments)
        self.assertIn('title="${escapeHtml(fullLabel)}"', instruments)
        self.assertIn('aria-label="${escapeHtml(fullLabel)}"', instruments)
        self.assertIn('data-pulse-kind="${escapeHtml(kind)}"', instruments)
        self.assertIn("root.innerHTML", instruments)
        self.assertIn("renderSystemPulse(elements.systemPulse, model)", instruments)
        self.assertNotIn("pulseInitial(label)", instruments)
        self.assertNotIn("elements.systemPulse.textContent = model ? systemPulseText(model)", instruments)

        css = (APP / "src" / "styles.css").read_text()
        self.assertRegex(css, r"\.system-pulse\s*\{[\s\S]*display:\s*flex")
        self.assertIn(".system-pulse-chip", css)
        self.assertIn(".system-pulse-chip b", css)
        self.assertIn(".system-pulse-chip em", css)
        self.assertRegex(css, r"\.system-pulse-chip\s*\{[\s\S]*grid-template-columns:\s*auto\s+auto")
        self.assertRegex(css, r"\.system-pulse-chip\s*\{[\s\S]*min-width:\s*82px")
        self.assertRegex(css, r"\.system-pulse-chip b\s*\{[\s\S]*line-height:\s*1\.12")
        self.assertRegex(css, r"\.system-pulse-chip em\s*\{[\s\S]*font-size:\s*0\.68rem")

    def test_disclosure_controls_have_strong_focus_affordance(self):
        css = (APP / "src" / "styles.css").read_text()
        for selector in [
            ".command-deck-drawer summary:focus-visible",
            ".command-metrics-detail summary:focus-visible",
            ".evidence-note-detail summary:focus-visible",
            ".action-route-summary:focus-visible",
            ".action-overflow-detail summary:focus-visible",
            ".source-records-detail summary:focus-visible",
            ".approval-metadata-detail summary:focus-visible",
            ".approval-history-drawer summary:focus-visible",
            ".proof-dossier-detail summary:focus-visible",
            ".proof-detail-drawer summary:focus-visible",
            ".proof-capabilities-detail summary:focus-visible",
            ".system-integrity-detail summary:focus-visible",
        ]:
            self.assertIn(selector, css)
        self.assertRegex(css, r"\.command-deck-drawer summary:focus-visible[\s\S]*outline:\s*2px\s+solid\s+var\(--blue\)")
        self.assertRegex(css, r"\.command-deck-drawer summary:hover[\s\S]*border-color:\s*rgba\(104,\s*168,\s*255,\s*0\.35\)")
        self.assertRegex(css, r"\.command-deck-drawer summary:hover[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.06\)")

    def test_bottom_instruments_are_single_row_compact_dock(self):
        instruments = (APP / "src" / "instruments.js").read_text()
        self.assertIn("const visibleModes = modes.slice(0, 3)", instruments)
        self.assertIn("const modeLabel = String(mode || \"Mode\")", instruments)
        self.assertIn("truncateText(modeLabel, 9)", instruments)
        self.assertIn('title="${escapeHtml(modeLabel)}"', instruments)
        self.assertIn('aria-label="${escapeHtml(modeLabel)}"', instruments)
        self.assertIn("elements.currentBlock.title = currentBlockAccessibleText(model, selectedId)", instruments)
        self.assertIn('elements.currentBlock.setAttribute?.("aria-label", currentBlockAccessibleText(model, selectedId))', instruments)

        css = (APP / "src" / "styles.css").read_text()
        self.assertRegex(css, r"\.bottom-instruments\s*\{[\s\S]*position:\s*absolute")
        self.assertRegex(css, r"\.bottom-instruments\s*\{[\s\S]*width:\s*min\(360px")
        self.assertRegex(css, r"\.bottom-instruments\s*\{[\s\S]*min-height:\s*42px")
        self.assertRegex(css, r"\.bottom-instruments\s*\{[\s\S]*padding:\s*6px\s+8px")
        self.assertRegex(css, r"\.play-button\s*\{[\s\S]*grid-auto-flow:\s*column")
        self.assertRegex(css, r"\.play-button\s*\{[\s\S]*min-width:\s*74px")
        self.assertIn(".play-button-label", css)
        self.assertRegex(css, r"\.mode-strip\s*\{[\s\S]*display:\s*none")
        self.assertRegex(css, r"\.mode-button\s*\{[\s\S]*max-width:\s*100px")
        self.assertRegex(css, r"\.mode-button\s*\{[\s\S]*box-sizing:\s*border-box")
        self.assertRegex(css, r"\.mode-button\s*\{[\s\S]*text-overflow:\s*ellipsis")

    def test_world_labels_are_compact_accessible_markers(self):
        instruments = (APP / "src" / "instruments.js").read_text()
        self.assertIn("function labelDisplayText", instruments)
        self.assertIn("function labelDisplayName", instruments)
        self.assertIn("function isSentenceLikeLabel", instruments)
        self.assertIn("function labelIdSuffix", instruments)
        self.assertIn("function labelAccessibleText", instruments)
        self.assertIn("truncateText(labelDisplayName(label), label.role === \"selected\" ? 42 : 34)", instruments)
        self.assertIn("if (!isSentenceLikeLabel(name)) return name", instruments)
        self.assertIn("return `${type} ${suffix}`.trim()", instruments)
        self.assertIn("element.title = labelAccessibleText(label)", instruments)
        self.assertIn("element.setAttribute(\"aria-label\", labelAccessibleText(label))", instruments)
        self.assertIn('title="${escapeHtml(labelAccessibleText(label))}"', instruments)
        self.assertIn('aria-label="${escapeHtml(labelAccessibleText(label))}"', instruments)
        self.assertIn("<strong>${escapeHtml(labelDisplayText(label))}</strong>", instruments)

        css = (APP / "src" / "styles.css").read_text()
        self.assertRegex(css, r"\.world-label\s*\{[\s\S]*max-width:\s*148px")
        self.assertRegex(css, r"\.world-label\[data-label-role=\"selected\"\]\s*\{[\s\S]*max-width:\s*204px")
        self.assertRegex(css, r"\.world-label strong\s*\{[\s\S]*max-width:\s*100%")
        self.assertRegex(css, r"\.world-label strong\s*\{[\s\S]*-webkit-line-clamp:\s*2")
        self.assertRegex(css, r"\.world-label strong\s*\{[\s\S]*white-space:\s*normal")
        self.assertRegex(css, r"\.world-label strong\s*\{[\s\S]*overflow-wrap:\s*anywhere")
        self.assertRegex(css, r"\.world-label:not\(\[data-label-role=\"selected\"\]\)\s*\{[\s\S]*padding:\s*6px\s+9px")

    def test_system_drawer_uses_compact_readout_grid(self):
        instruments = (APP / "src" / "instruments.js").read_text()
        self.assertIn('class="system-readout system-readout-grid"', instruments)
        self.assertIn("system-integrity-detail", instruments)
        self.assertIn("system-integrity-grid", instruments)
        self.assertIn('field("Health warnings", graphWarnings.length)', instruments)

        css = (APP / "src" / "styles.css").read_text()
        self.assertIn(".system-readout-grid", css)
        self.assertIn(".system-integrity-detail", css)
        self.assertIn(".system-integrity-grid", css)
        self.assertRegex(css, r"\.system-readout-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)")
        self.assertRegex(css, r"\.system-readout-grid \.readout-field\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)")
        self.assertRegex(css, r"\.system-integrity-detail:not\(\[open\]\) \.system-integrity-grid\s*\{[\s\S]*display:\s*none")

    def test_main_wires_world_instruments_and_commands(self):
        main_js = (APP / "src" / "main.js").read_text()
        index_html = (APP / "index.html").read_text()
        for value in [
            "loadProductState",
            "buildSurfaceModel",
            "buildFocusContext",
            "createWorldScene",
            "renderInstruments",
            "renderInspector",
            "buildReviewDraftPreview",
            "activeReviewDraftPreview",
            "createCommandPalette",
            "onSelect",
            "onHover",
            "currentFocusContext",
            "hoveredId",
            "setFocusState",
            "relationPrev: document.querySelector(\"#relation-prev-world\")",
            "relationNext: document.querySelector(\"#relation-next-world\")",
            "function relationNavigationTargets",
            "function selectAdjacentRelationship",
            "syncRelationNavigation()",
            "elements.relationPrev?.addEventListener",
            "elements.relationNext?.addEventListener",
        ]:
            self.assertIn(value, main_js)

        self.assertIn('id="relation-prev-world"', index_html)
        self.assertIn('id="relation-next-world"', index_html)
        self.assertIn('aria-label="Previous connection"', index_html)
        self.assertIn('aria-label="Next connection"', index_html)

    def test_command_palette_behaves_like_real_modal_navigation(self):
        commands_js = (APP / "src" / "commands.js").read_text()
        main_js = (APP / "src" / "main.js").read_text()

        for value in [
            "function publicSearchLabel",
            "function publicSearchDetail",
            "function displayEndpoint",
            "return \"Open connection\"",
            "const countMatch = detail.match",
            "trigger, background",
            "let previousFocus = null",
            "function focusablePaletteElements",
            "function setModalIsolation",
            "background.inert = true",
            'background.setAttribute("aria-hidden", "true")',
            "background.inert = false",
            'background.removeAttribute("aria-hidden")',
            'event.key === "Tab"',
            "event.shiftKey",
            'event.key === "Escape"',
            'shell?.addEventListener("mousedown"',
            "previousFocus !== trigger",
            "trigger.blur",
        ]:
            self.assertIn(value, commands_js)

        self.assertIn("trigger: elements.commandInput", main_js)
        self.assertIn("background: elements.app", main_js)

        query_js = (APP / "src" / "query.js").read_text()
        self.assertNotIn('"gravity"', query_js)
        self.assertNotIn("visual gravity", query_js)

    def test_product_app_cannot_persist_review_queue_items(self):
        app_sources = "\n".join(path.read_text() for path in (APP / "src").glob("*.js"))
        self.assertNotIn("localStorage.setItem", app_sources)
        self.assertNotIn("sessionStorage.setItem", app_sources)
        self.assertNotIn("indexedDB", app_sources)
        self.assertNotIn("writeFile", app_sources)
        self.assertNotIn("appendFile", app_sources)
        self.assertNotIn("sendBeacon", app_sources)
        self.assertNotIn("review-packet.mjs", app_sources)
        self.assertNotIn("fetch(\"/reviews/queue.json\"", app_sources)
        self.assertNotIn("fetch('/reviews/queue.json'", app_sources)
        self.assertIsNone(re.search(r"fetch\s*\([\s\S]*?method\s*:\s*[\"'](?:POST|PUT|PATCH|DELETE)[\"']", app_sources))
        self.assertIsNone(re.search(r"navigator\s*\.\s*sendBeacon", app_sources))
        self.assertIsNone(re.search(r"(?:localStorage|sessionStorage)\s*\.\s*setItem", app_sources))
        self.assertIsNone(re.search(r"\b(?:writeFile|appendFile)\s*\(", app_sources))


if __name__ == "__main__":
    unittest.main()
