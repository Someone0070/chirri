import { nanoid } from 'nanoid';

export const createId = (prefix: string, size = 21): string => `${prefix}${nanoid(size)}`;

export const userId = () => createId('usr_');
export const urlId = () => createId('url_');
export const sharedUrlId = () => createId('surl_');
export const changeId = () => createId('chg_');
export const userChangeId = () => createId('uc_');
export const checkResultId = () => createId('cr_');
export const webhookId = () => createId('wh_');
export const webhookDeliveryId = () => createId('whd_');
export const notificationId = () => createId('ntf_');
export const forecastId = () => createId('frc_');
export const userForecastId = () => createId('uf_');
export const secretId = () => createId('sec_');
export const oauthTokenId = () => createId('oat_');
export const integrationId = () => createId('int_');
export const ticketId = () => createId('tkt_');
export const feedbackId = () => createId('fb_');
export const sourceAlertPrefId = () => createId('sap_');
export const baselineId = () => createId('bl_');
export const headerSnapshotId = () => createId('hs_');
export const sharedSourceId = () => createId('ss_');
export const signalId = () => createId('sig_');
export const signalMatchId = () => createId('sm_');
export const discoveryResultId = () => createId('dr_');
export const learningSampleId = () => createId('ls_');
export const domainPatternId = () => createId('dp_');
export const packageVersionId = () => createId('pv_');
export const specSnapshotId = () => createId('sp_');
export const featureFlagId = () => createId('ff_');
export const notificationRuleId = () => createId('nr_');
export const simulationId = () => createId('sim_');
export const githubConnectionId = () => createId('ghc_');
export const githubIssueId = () => createId('ghi_');

// API key generators
export const apiKeyId = () => createId('apk_');
export const liveApiKey = () => createId('ck_live_', 32);
export const testApiKey = () => createId('ck_test_', 32);
