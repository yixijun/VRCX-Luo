import { request } from '../services/request';
const moderationReportReq = {
    getModerationReports(params) {
        return request('moderationReports', {
            method: 'GET',
            params
        }).then((json) => {
            const args = {
                json,
                params
            };
            return args;
        });
    },
    submitModerationReport(params) {
        return request('moderationReports', {
            method: 'POST',
            params
        }).then((json) => {
            const args = {
                json,
                params
            };
            return args;
        });
    },
    // deprecated
    deleteModerationReport(params) {
        return request(`moderationReports/${params.moderationReportId}`, {
            method: 'DELETE'
        }).then((json) => {
            const args = {
                json,
                params
            };
            return args;
        });
    }
};
export default moderationReportReq;
