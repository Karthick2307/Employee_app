import api from "./axios";

export const getPolls = (params) => api.get("/polls", { params });
export const getAssignedPolls = () => api.get("/polls/my");
export const getAssignedPoll = (assignmentId) => api.get(`/polls/my/${assignmentId}`);
export const submitPollResponse = (assignmentId, payload, config = {}) =>
  api.post(`/polls/my/${assignmentId}/submit`, payload, config);
