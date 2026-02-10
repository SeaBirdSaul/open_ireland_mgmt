/**
 * StatsPage component displays an overview of inventory statistics.
 * It provides metrics such as total device count, devices by status,
 *  devices by type, and devices by site.
 */
import React, { useState } from 'react';
import { PageHeader, Card } from '@tcdona/ui';
import { useDeviceCount, useDevicesByStatus, useDevicesByTypes, useDevicesBySite } from '../hooks/useDevices';
import { useDeviceTypes, useDeviceTypeCount, useSites, useSiteCount } from '../hooks/useInventoryData';

/**
 * Currently using legacy inputs (Available, Maintenance, Unavailable) to useDeviceByStatus
 * Eventually update to use new inputs (active, in_maintenance, retired, spare, planned)
 */
export default function StatsPage() {
  const { data: devicesCount, isLoading: isCountLoading, error: countError } = useDeviceCount();
  const { data: availableCount, isLoading: isAvailableLoading, error: availableError } = useDevicesByStatus('Available');
  const { data: maintenanceCount, isLoading: isMaintenanceLoading, error: maintenanceError } = useDevicesByStatus('Maintenance');
  const { data: retiredCount, isLoading: isRetiredLoading, error: retiredError } = useDevicesByStatus('Unavailable');
  const { data: TypeCount } = useDeviceTypeCount();
  const typeIds = Array.from({ length: TypeCount }, (_, i) => String(i + 1));
  const { data: countsByType, isLoading: isTypeCountsLoading, error: typeCountsError } = useDevicesByTypes(typeIds);
  const { data: deviceTypes, isLoading: isDeviceTypesLoading, error: deviceTypesError } = useDeviceTypes();
  const { data: SiteCount } = useSiteCount();
  const siteIds = Array.from({ length: SiteCount }, (_, i) => String(i + 1));
  const { data: countsBySite, isLoading: isSiteCountsLoading, error: siteCountError } = useDevicesBySite(siteIds);
  const { data: deviceSites, isLoading: isSitesLoading, error: sitesError } = useSites();
  const [activeTab, setActiveTab] = useState('status');

  const typeNameByID = React.useMemo(() => {
    const list = Array.isArray(deviceTypes)
      ? deviceTypes
      : deviceTypes?.results || [];
    const map = {};
    list.forEach((t) => {
      map[String(t.id)] = t.name;
    });
    return map;
  }, [deviceTypes]);
  const siteNameByID = React.useMemo(() => {
    const list = Array.isArray(deviceSites)
      ? deviceSites
      : deviceSites?.results || [];
    const map = {};
    list.forEach((t) => {
      map[String(t.id)] = t.name;
    });
    return map;
  }, [deviceSites]);
  return (
    <div className="p-6">
      <PageHeader
        title="Inventory Overview"
        subtitle="Statistics and metrics for inventory management"
      />
      <div className="mt-6">
        <Card>
          <div className="p-4">
            <p className="text-gray-600 dark:text-gray-400">
              Total device count:{' '}
              {countError
                ? 'Error'
                : isCountLoading
                  ? 'Loading...'
                  : devicesCount}
              <div className="flex gap-2 border-b border-grey-200 dark:border-grey-700">
                <button
                  className={`px-3 py-2 text-sm font-medium border-b-2 ${
                    activeTab === 'status'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-grey-600 dark:text-gray-400'
                  }` }
                  onClick={() => setActiveTab('status')}
                >
                  Status
                </button>
                <button
                  className={`px-3 py-2 text-sm font-medium border-b-2 ${
                    activeTab === 'type'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-grey-600 dark:text-gray-400'
                  }` }
                  onClick={() => setActiveTab('type')}
                >
                  Type
                </button>
                <button
                  className={`px-3 py-2 text-sm font-medium border-b-2 ${
                    activeTab === 'sites'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-grey-600 dark:text-gray-400'
                  }` }
                  onClick={() => setActiveTab('sites')}
                >
                  Sites
                </button>
              </div>
              <div className='mt-4'>
                {activeTab === 'status' && (
                  <div>
                    Devices by status:
                      <table style={{ width: '100%' }}>
                        <tr>
                          <th style={{ color: 'green' }}>AVAILABLE</th>
                          <th style={{ color: 'red' }}>MAINTENANCE</th>
                          <th>RETIRED</th>
                        </tr>
                        <tr>
                          <th style={{ color: 'green' }}>{availableError
                          ? 'Error'
                          : isAvailableLoading
                            ? ' Loading...'
                            : availableCount}
                          </th>
                          <th style={{ color: 'red' }}>{maintenanceError
                          ? 'Error'
                          : isMaintenanceLoading
                            ? ' Loading...'
                            : maintenanceCount}
                          </th>
                          <th>
                            {retiredError
                          ? 'Error'
                          : isRetiredLoading
                            ? ' Loading...'
                            : retiredCount}
                          </th>
                        </tr>
                      </table>
                  </div>
                )}
              </div>
              <div className='mt-4'>
                {activeTab === 'type' && (
                  <div>
                    Device by type
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr>
                            <th className="text-left py-2">Types</th>
                            <th className="text-left py-2">Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {typeIds.map((id) => (
                            <tr key={id} className="border-t border-gray-200 dark:border-gray-700">
                              <td className="py-2">
                                {deviceTypesError
                                ? ' Type Error'
                                : isDeviceTypesLoading
                                  ? 'loading...'
                                  : typeNameByID[id] || 'Type ${id}'}
                              </td>
                              <td className="py-2">
                                {typeCountsError ? 'Error' : isTypeCountsLoading ? 'Loading...' : countsByType?.[id] ?? 0}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                  </div>
                )}
              </div>
              <div className='mt-4'>
                {activeTab === 'sites' && (
                  <div>
                    Device by site
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr>
                            <th className="text-left py-2">Types</th>
                            <th className="text-left py-2">Count</th>
                          </tr>
                        </thead>
                        <tbody>
                            {siteIds.map((id) => (
                            <tr key={id} className="border-t border-gray-200 dark:border-gray-700">
                              <td className="py-2">
                                {sitesError
                                ? ' Type Error'
                                : isSitesLoading
                                  ? 'loading...'
                                  : siteNameByID[id] || 'Type ${id}'}
                              </td>
                              <td className="py-2">
                                {siteCountError ? 'Error' : isSiteCountsLoading ? 'Loading...' : countsBySite?.[id] ?? 0}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                  </div>
                )}
              </div>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
