/**
 * Web Vitals reporting for the inventory management frontend application.
 * Measures performance metrics like CLS, FID, LCP, etc.
 * Can log results to console or send to an analytics endpoint.
 * Uses the web-vitals library for metric collection.
 */
const reportWebVitals = onPerfEntry => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS(onPerfEntry);
      getFID(onPerfEntry);
      getFCP(onPerfEntry);
      getLCP(onPerfEntry);
      getTTFB(onPerfEntry);
    });
  }
};

export default reportWebVitals;

