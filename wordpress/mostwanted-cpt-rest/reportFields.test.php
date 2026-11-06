<?php
namespace Elementor\Core\DynamicTags {
    abstract class Data_Tag {
        public $settings = [];
        public $controls = [];
        public function get_settings($name) { return $this->settings[$name] ?? null; }
        protected function add_control($name, $options) { $this->controls[$name] = $options; }
        public function initialize_controls() { $this->register_controls(); }
    }
}
namespace Elementor\Modules\DynamicTags {
    class Module { const IMAGE_CATEGORY = 'image'; }
}
namespace Elementor {
    class Controls_Manager { const SELECT = 'select'; }
}
namespace {
    require __DIR__ . DIRECTORY_SEPARATOR . 'reportEdit.test.php';

    mw_register_report_acf_fields();
    check(!function_exists('acf_add_local_field_group'), 'Plugin remains usable without ACF or Elementor');
    if (!function_exists('acf_add_local_field_group')) {
        function acf_add_local_field_group($group) { $GLOBALS['acf_group'] = $group; }
    }
    $GLOBALS['front_logged_in'] = true;
    $GLOBALS['meta'][1] = [
        '_mw_nickname' => 'Fallback', '_mw_rid' => '177292272', '_mw_created_at' => '2026-11-05 12:00:00',
        '_mw_report_payload' => [
            'nickname' => '-Flocki-', 'reason' => "Linea 1\nLinea 2 \"quoted\" C:\\evidence <script>bad()</script>",
            'playerId' => 'RID-177292272', 'aliases' => ['Before', 'Earlier'],
            'typesOfInfraction' => ['MODDER'],
            'labels' => [['id' => 26, 'label' => 'Crash', 'detail' => 'Forced crash']],
            'crews' => [['name' => 'Crew A', 'url' => 'https://crew.test/a'], ['name' => 'Crew B', 'url' => '']],
            'avatar1' => 'https://images.test/avatar.png', 'avatar2' => 'javascript:alert(1)',
            'evidence' => [
                ['name' => 'Screenshot', 'url' => 'https://images.test/evidence.png', 'contentType' => 'image/png'],
                ['name' => 'Video', 'url' => 'https://images.test/evidence.mp4', 'contentType' => 'video/mp4'],
            ],
            'analysis' => ['summary' => 'Stored summary', 'severity' => 'alta'],
            'reporter' => ['name' => 'PRIVATE_AUTHOR'], 'ip' => 'PRIVATE_IP', 'severity' => 'alta',
            'customInternal' => 'PRIVATE_INTERNAL',
        ],
        '_mw_community_verification' => [
            'up' => 3, 'down' => 1,
            'votesByVoter' => ['PRIVATE_VOTER' => ['voteType' => 'down']],
            'feedback' => [['reason' => 'Public reason', 'ip' => 'PRIVATE_IP', 'voterId' => 'PRIVATE_VOTER']],
        ],
    ];
    $GLOBALS['meta'][9] = ['_mw_nickname' => 'Player CPT'];
    $before = $GLOBALS['meta'];
    mw_register_report_acf_fields();
    $group = $GLOBALS['acf_group'];
    check($group['location'][0][0]['value'] === 'mw_report' && $group['show_in_rest'] === 0, 'ACF group targets report CPT without opening REST access');
    $fields = [];
    foreach ($group['fields'] as $field) {
        check(in_array($field['type'], ['text', 'textarea', 'url', 'number'], true), 'Use only ACF Free field types');
        check($field['readonly'] === 1 && $field['disabled'] === 1, 'Every ACF field is read-only');
        $fields[$field['name']] = $field;
    }
    check(count($fields) === 25, 'Expose all documented fields, including five individual evidence URLs');
    $load = static function ($name, $post_id = 1) use ($fields) {
        $key = mw_report_acf_reference(null, $name, $post_id);
        check($key === $fields[$name]['key'], 'Resolve field names without saved ACF reference metadata');
        return mw_report_acf_value('STALE_ACF_VALUE', $post_id, $fields[$name]);
    };
    check($load('mw_report_nickname') === '-Flocki-' && $load('mw_report_rid') === '177292272', 'Historical reports work without migration, preserving exact names and title/RID fallbacks');
    check($load('mw_report_aliases') === "Before\nEarlier", 'ACF exposes plain-text aliases rather than serialized arrays');
    check($load('mw_report_reason') === $before[1]['_mw_report_payload']['reason'], 'Preserve original multiline text, quotes and backslashes');
    check($load('mw_report_labels') === 'Crash' && $load('mw_report_label_details') === 'Crash: Forced crash', 'Separate labels and details');
    check($load('mw_report_crews') === "Crew A\nCrew B" && $load('mw_report_crew_urls') === 'https://crew.test/a', 'Expose crews and URLs without array indexes');
    check($load('mw_report_analysis') === 'Stored summary', 'Expose only the saved analysis summary, not arbitrary analysis internals');
    unset($GLOBALS['meta'][1]['_mw_report_payload']['analysis']);
    $GLOBALS['meta'][1]['_mw_report_payload']['report']['analysis'] = ['summary' => 'Historical nested summary'];
    check($load('mw_report_analysis') === 'Historical nested summary', 'Keep analysis stored in historical nested payloads');
    $GLOBALS['meta'] = $before;
    check($load('mw_report_evidence_count') === 2 && $load('mw_report_evidence_2') === 'https://images.test/evidence.mp4', 'Keep video evidence URLs as well as images');
    check($load('mw_report_votes_up') === 3 && $load('mw_report_votes_down') === 1 && $load('mw_report_vote_feedback') === 'Public reason', 'Expose public vote data without voter identities');
    check(mw_report_acf_reference('other', 'unrelated', 1) === 'other'
        && mw_report_acf_reference(null, 'mw_report_nickname', 9) === null, 'Do not intercept unrelated fields or player CPT');
    check(mw_report_acf_value('other', 1, ['key' => 'field_other', 'name' => 'other']) === 'other', 'Leave other ACF values unchanged');
    check(mw_report_acf_value(null, 'options', $fields['mw_report_nickname']) === ''
        && mw_report_acf_value(null, 9, $fields['mw_report_nickname']) === '', 'Reject options and unrelated posts');
    $snapshot = [];
    foreach ($fields as $name => $field) {
        $snapshot[$name] = $load($name);
        check(mw_report_acf_prevent_update(null, 'forged', 1, $field) === false, 'Reject ACF programmatic writes, not just disabled form inputs');
        $field['readonly'] = $field['disabled'] = 0;
        $field['name'] = 'acf[' . $field['key'] . ']';
        $prepared = mw_report_acf_prepare($field);
        check($prepared['readonly'] === 1 && $prepared['disabled'] === 1, 'Reapply read-only rendering');
    }
    check(strpos(json_encode($snapshot), 'PRIVATE') === false && !isset($fields['mw_report_severity']), 'No private or retired data in Elementor fields');
    check($GLOBALS['meta'] === $before, 'Reading historical ACF fields must not write or duplicate post meta');
    check(empty($GLOBALS['filters']['the_content']) && empty($GLOBALS['hooks']['wp_enqueue_scripts'])
        && empty($GLOBALS['hooks']['wp_head']), 'Expose fields without injecting frontend markup, CSS or global body overrides');
    $GLOBALS['meta'][1]['_mw_report_payload']['nickname'] = 'Corrected in MostWanted';
    $GLOBALS['meta'][1]['_mw_community_verification']['up'] = 4;
    check($load('mw_report_nickname') === 'Corrected in MostWanted' && $load('mw_report_votes_up') === 4, 'Read current source, not stale ACF value cache or duplicate metadata');
    $GLOBALS['meta'][1]['_mw_report_payload']['evidence'] = array_fill(0, 7, ['url' => 'https://images.test/legacy.png']);
    check($load('mw_report_evidence_count') === 7 && count(explode("\n", $load('mw_report_evidence_urls'))) === 7, 'Do not truncate historical evidence to five');
    $GLOBALS['meta'] = $before;
    check(mw_report_elementor_image(1, 'avatar_1') === ['id' => 0, 'url' => 'https://images.test/avatar.png'], 'External images do not require attachment imports');
    check(mw_report_elementor_image(1, 'evidence_1')['url'] === 'https://images.test/evidence.png', 'Image widgets can use report evidence');
    check(mw_report_elementor_image(1, 'evidence_2') === [] && mw_report_elementor_image(1, 'avatar_2') === [], 'Do not pass videos or unsafe URLs to image widgets');
    check(mw_report_elementor_image(9, 'avatar_1') === [] && mw_report_elementor_image(1, 'nickname') === [], 'Image tag accepts only image source fields on report CPT');
    $manager = new class {
        public $tag;
        public $groups = [];
        public function register_group($name, $group) { $this->groups[$name] = $group; }
        public function register($tag) { $this->tag = $tag; }
    };
    $GLOBALS['hooks']['elementor/dynamic_tags/register']($manager);
    check($manager->tag->get_categories() === ['image'] && $manager->tag->get_group() === ['mostwanted'], 'Register the image tag in Elementor with the correct data category');
    $manager->tag->initialize_controls();
    check(count($manager->tag->controls['field']['options']) === 7, 'Allow two avatars and five evidence images in widget selection');
    $manager->tag->settings['field'] = 'avatar_1';
    check($manager->tag->get_value()['url'] === 'https://images.test/avatar.png', 'Dynamic image tag uses the current report');
    $GLOBALS['front_logged_in'] = false;
    check($load('mw_report_nickname') === '' && $manager->tag->get_value() === [], 'Anonymous templates and cached ACF reads cannot expose report values');
    $GLOBALS['front_logged_in'] = true;
    $GLOBALS['is_admin_user'] = false;
    unset($GLOBALS['box']);
    mw_add_report_meta_box();
    check(!isset($GLOBALS['box']), 'With ACF, do not duplicate report fields in the generic box');
    $GLOBALS['is_admin_user'] = true;
    mw_add_report_meta_box();
    check($GLOBALS['box'][0] === 'mw-report-internal', 'Keep privileged diagnostics in a separate private box');
    ob_start();
    mw_render_report_internal_meta_box((object) ['ID' => 1]);
    $private_html = ob_get_clean();
    check(strpos($private_html, '<details>') !== false && strpos($private_html, 'PRIVATE_AUTHOR') !== false, 'Raw payload is collapsed and restricted to administration');
    $html = mw_report_readonly_html(1);
    check(strpos($html, '<th scope="row">Nombre del jugador</th>') !== false
        && strpos($html, '<dt>nickname</dt>') === false && strpos($html, '<dt>0</dt>') === false, 'Fallback uses named individual fields, not a recursive API dump');
    check(strpos($html, '<script>') === false && strpos($html, '&lt;script&gt;') !== false && strpos($html, 'PRIVATE') === false, 'Fallback escapes values and never exposes the raw payload');
    echo "OK ACF Free read-only fields: historical data, reference resolution, live values, no writes, privacy, Elementor images and fallback rendering\n";
}
