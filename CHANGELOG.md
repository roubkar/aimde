# Changelog

## 1.0.11 Aug 15 2020
- Fix panel height issue (gorarakelyan)

## 1.0.10 Aug 14 2020
- Integrate runs search powered by AimQL (gorarakelyan)

## 1.0.9 Jul 29 2020
- Add segments integration (gorarakelyan)

## 1.0.8 Jul 24 2020
- Fix projects blueprint endpoints (gorarakelyan)
- Make table header stick to the top of context area (gorarakelyan)

## 1.0.7 Jul 23 2020
- Fix tf summary loading alert in Panel (gorarakelyan)

## 1.0.6 Jul 23 2020
- Get rid of index run of experiment (gorarakelyan)
- Ability to navigate to tf logs screen from main sidebar (gorarakelyan)
- Ability to list and edit parameters of attached TF Summary logs (gorarakelyan)
- Fix panel URL state management issue (gorarakelyan)
- Add search bar icon on panel page main search bar (gorarakelyan)
- Add tf.summary adapter to featch and show logged scalars (gorarakelyan)
- Show tags in related experiment detail screen (jialin-wu-02)
- Display Information on Navbar (jialin-wu-02)
- Add Status Indicator to Sidebar (jialin-wu-02)

## 1.0.5 Jul 18 2020
- Show information about tf.summary scalars in context area (gorarakelyan)
- Render tf.summary scalars on chart area (gorarakelyan)
- Add tf.summary adapter for reading logs (gorarakelyan)

## 1.0.4 Jul 13 2020
- Ability to recover panel state from URL (gorarakelyan)
- Add ability to filter runs by a parameter (gorarakelyan)

## 1.0.3 Jul 8 2020
- Integrate GA (gorarakelyan)

## 1.0.2 Jul 7 2020
- Add ability to go to create tag screen from panel popup (gorarakelyan)
- Show runs parameters in context area (gorarakelyan)
- Add ability to set Y axis scale function (gorarakelyan)
- Move chart hover tooltip information to context area (gorarakelyan)
- Change the panel structure to be wider and become the primary space (gorarakelyan)

## 1.0.1 Jun 22 2020
- Save experiment name in commit table when attaching a tag (gorarakelyan)

## 1.0.0 Jun 18 2020
- Ability to select and attach a tag to a training run from popup (gorarakelyan)
- Implement tags list screen to retrieve and show added tags (gorarakelyan)
- Add ability to create a new tag (gorarakelyan)
- Navigate to process screen from control panel (gorarakelyan)
- Add executed processes history and detail screen (gorarakelyan)
- Add executable template detail screen (gorarakelyan)
- Show executed process status in control panel and add ability to kill it (gorarakelyan)
- Execute training from template connected to a commit of specific experiment (gorarakelyan)
- Show training commit info inside popup: message, date, experiment (gorarakelyan)
- Ability to run training tracked with aim from executable tpl (gorarakelyan)
- Start a training from saved template (gorarakelyan)
- Ability to kill a running process from control panel (gorarakelyan)
- Show running process in control panel (gorarakelyan)
- Add executable run API method (gorarakelyan)
- Add executable create API method (gorarakelyan)
- Add ability to execute a process on the host (gorarakelyan)
- Ability to select and plot specific metric (gorarakelyan)
- Smoothen line charts by rendering each Nth value (gorarakelyan)
- Make trainings differentiable from each other by tag color (gorarakelyan)
- Show chart lines values inside popup when hovering on chart area (gorarakelyan)
- Add ability to open training detail screen from popup (gorarakelyan)
- Add Ability to search commits by tag name (gorarakelyan)
- Show commit tags inside popup (gorarakelyan)
- Control panel skeleton (gorarakelyan)
- Add ability to receive port as an argument (gorarakelyan)

## 0.1.2 Apr 16 2020
- Integrate aimrecords storage (gorarakelyan)
- Start Tornado WebSocket server with supervisor (gorarakelyan)
- Add real time update to metrics (gorarakelyan)
- Add group line charts plot insight (gorarakelyan)

## 0.1.1 Mar 14 2020
- Send subscription event after conn init (gorarakelyan)
- Remove real time update for non-index experiment (gorarakelyan)

## 0.1.0 Mar 14 2020
- Auto detect server host from client (gorarakelyan)
- Change ports from 8000,1,2 to 43800,1,2 (gorarakelyan)
- Add Profiler real time update (gorarakelyan)
- Add current run visualization (gorarakelyan)
- Add initial skeleton (gorarakelyan)