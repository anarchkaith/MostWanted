<?php
define('ABSPATH', __DIR__);
function add_action(...$args) {}
function add_filter(...$args) {}
function register_activation_hook(...$args) {}
function register_deactivation_hook(...$args) {}
function get_the_title($id) { return 'Player'; }
function get_post_meta($id, $key, $single) {
    return $GLOBALS['test_meta'][$key] ?? '';
}
require __DIR__ . DIRECTORY_SEPARATOR . 'mostwanted-cpt-rest.php';

function check($condition, $message) {
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$GLOBALS['test_meta'] = [
    '_mw_report_payload' => [
        'nickname' => 'Player', 'rid' => '123', 'reason' => 'Denuncia',
        'reporter' => ['name' => 'PRIVATE_NAME', 'id' => 'PRIVATE_ID', 'ip' => 'PRIVATE_IP'],
        'reportedby' => 'PRIVATE_NAME', 'reportadoPor' => 'PRIVATE_NAME',
        'contacto' => 'PRIVATE_CONTACT', 'metadata' => ['reporter' => 'PRIVATE_NAME'],
        'report' => ['reportedby' => 'PRIVATE_NESTED', 'categories' => ['MODDER']],
        'avatar1' => 'avatar.png', 'severity' => 'alta',
        'evidence' => [['url' => 'evidence.png']],
    ],
    '_mw_created_at' => '2026-10-01',
    '_mw_community_verification' => [
        'up' => 2, 'down' => 1,
        'feedback' => [['author' => 'PRIVATE_VOTER', 'ip' => 'PRIVATE_VOTER_IP', 'reason' => 'Revisar']],
        'votesByVoter' => ['PRIVATE_VOTER' => 'up'],
    ],
];
$before = $GLOBALS['test_meta'];
$report = mw_map_report_item(1);
check(strpos(json_encode($report), 'PRIVATE') === false, 'Public API must not expose reporter identity');
check($GLOBALS['test_meta'] === $before, 'Public serialization must preserve internal attribution');
check($report['nickname'] === 'Player' && $report['rid'] === '123', 'Keep player identity');
check($report['severity'] === 'alta' && $report['avatar1'] === 'avatar.png', 'Keep report metadata');
check($report['content'] === 'Denuncia' && count($report['evidence']) === 1, 'Keep reason and evidence');
check($report['communityVerification']['up'] === 2, 'Keep votes');
check($report['communityVerification']['confirmations'][0]['reason'] === 'Revisar', 'Keep vote reasons');
unset($GLOBALS['test_meta']['_mw_report_payload']['reporter']);
$GLOBALS['test_meta']['_mw_reporter'] = ['name' => 'PRIVATE_LEGACY_NAME'];
check(strpos(json_encode(mw_map_report_item(1)), 'PRIVATE') === false, 'Legacy reporter meta stays private');
echo "OK WordPress public report privacy and preserved internal storage\n";
