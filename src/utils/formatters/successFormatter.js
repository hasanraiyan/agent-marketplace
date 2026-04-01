/**
 * successFormatter - Formats successful responses
 * Interface Segregation: Only handles success responses
 */
const formatSuccess = (data, message = 'Success', code = 200) => ({
  success: true,
  statusCode: code,
  message,
  data,
  timestamp: new Date().toISOString(),
});

const formatList = (items, total, page = 1, limit = 10) => ({
  success: true,
  statusCode: 200,
  message: 'Data retrieved successfully',
  data: {
    items,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  },
  timestamp: new Date().toISOString(),
});

export default {
  formatSuccess,
  formatList,
};
