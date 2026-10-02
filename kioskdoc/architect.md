# 시스템 아키텍처 설계

## 1. 전체 토폴로지
- **Client Layer**: 
  - Desktop Kiosk: Tauri 2 (Rust + React) - Windows/Linux 지원, 로컬 하드웨어 제어 우위.
  - Android Kiosk: PWA / TWA (Bubblewrap) - Play Store 배포 및 키오스크 잠금 모드(Kiosk Mode) 지원.
- **API Gateway / Load Balancer**: Nginx 또는 Traefik (서브도메인 라우팅 및 SSL 종료).
- **Backend Layer**: Rust (Axum) - 고성능, 낮은 메모리 풋프린트, 멀티테넌시 미들웨어 내장.
- **Data Layer**: 
  - PostgreSQL: 멀티테넌트 관계형 데이터 (Row-level security 또는 `tenant_id` 컬럼 기반).
  - Redis: 세션 관리, 템플릿 캐싱, 실시간 기기 상태(Heartbeat) 관리.
- **Message Broker**: MQTT 또는 WebSocket (서버에서 키오스크로 실시간 템플릿 업데이트/명령 푸시).

## 2. 멀티테넌시 전략
- **Database per Tenant** 또는 **Shared Database with `tenant_id`**: 초기 확장성과 유지보수성을 고려하여 Shared Database + `tenant_id` + Row-Level Security(RLS) 방식 채택.
- **Routing**: 미들웨어에서 `Host` 헤더(`{tenant}.domain.com`)를 파싱하여 `tenant_id`를 컨텍스트에 주입.

## 3. 템플릿 엔진 아키텍처
- 에디터(Admin): React + HTML5 Drag-and-Drop (또는 GrapesJS 커스터마이징) → JSON 스키마 생성.
- 플레이어(Client): JSON 스키마를 파싱하여 동적 React 컴포넌트 트리 렌더링.

# [프롬프트 목표] 하이브리드 클라우드, 엣지 동기화, 데이터 흐름을 포함한 전체 시스템 토폴로지를 정의한다.

## 1. 아키텍처 스타일
- **Backend**: Rust (Axum) 기반의 경량, 고동시성 마이크로서비스 (멀티테넌시 미들웨어 내장).
- **Frontend (Admin)**: React 18 + TypeScript + Vite + Recharts/ECharts (통계 시각화).
- **Frontend (Kiosk Client)**: Tauri 2 (Windows/Linux) + PWA/TWA (Android).
- **Database**: PostgreSQL (Cloud), SQLite (Local Closed-Cloud Fallback).

## 2. 핵심 데이터 흐름 (Data Flow)
1. **템플릿 배포**: Admin JSON 생성 → S3/Local Storage 업로드 → WebSocket/MQTT로 키오스크에 변경 알림 → 키오스크가 JSON 및 에셋 다운로드 및 로컬 캐싱.
2. **설문 및 수행 데이터 수집**: 키오스크에서 설문 응답 → 로컬 SQLite에 `pending` 상태로 저장 → 네트워크 감지 시 백그라운드 워커가 배치로 서버 API(`/api/v1/analytics/submit`)로 전송.
3. **시각화**: 서버가 수신한 데이터를 집계(Aggregation) → Admin 대시보드에서 실시간 차트 렌더링.

## 3. 놓치기 쉬운 아키텍처 보완 (Gap Filling)
- **Edge Sync Queue**: 키오스크 Tauri 내부에 `sqlx` + SQLite를 사용하여 오프라인 설문 응답을 큐잉하고, 전송 성공 시만 삭제하는 트랜잭션 보장 로직 필수.
- **CDN/에셋 최적화**: 관리자가 업로드한 고해상도 이미지는 서버에서 WebP 포맷 및 기기 해상도별(15/24/32)로 자동 변환하여 제공.

- **메타 엔진 아키텍처**: 백엔드는 단순 CRUD가 아니라, 테넌트별로 정의된 JSON 스키마를 기반으로 동적 API 엔드포인트를 생성하는 'GraphQL-like Dynamic Resolver' 계층을 포함해야 함.
- **클라이언트 엔진**: Tauri 앱 내부에 'Template Parser'와 'Action Executor', 'Local State Store'로 구성된 경량 런타임 엔진이 내장되어야 함.

🎨 [프론트엔드 마스터 구현] 노코드 키오스크 에디터 (데이터 바인딩 + 액션 체인 빌더)
1. 에디터 전체 아키텍처 및 컴포넌트 트리
src/
├── editor/
│   ├── store/                    # Zustand 전역 상태
│   │   ├── useEditorStore.ts     # 캔버스 상태 (컴포넌트 트리)
│   │   ├── useDatasetStore.ts    # 데이터셋 레지스트리
│   │   └── useActionStore.ts     # 액션 체인 정의
│   ├── canvas/                   # 중앙 캔버스 영역
│   │   ├── KioskCanvas.tsx       # 15/24/32인치 반응형 캔버스
│   │   ├── DraggableComponent.tsx
│   │   └── DeviceFrame.tsx       # 베젤 프레임 (디바이스 프리뷰)
│   ├── panels/
│   │   ├── ComponentPalette.tsx  # 좌측: UI 컴포넌트 팔레트
│   │   ├── DatasetPanel.tsx      # 우측 상단: 데이터셋 바인딩 패널
│   │   ├── PropertyPanel.tsx     # 우측 하단: 속성 편집 패널
│   │   └── ActionChainBuilder.tsx # 하단: 액션 체인 시각적 에디터
│   └── serializers/
│       └── templateSerializer.ts # 최종 JSON 스키마 직렬화

2. Zustand 상태 관리 (전역 스토어)
// src/editor/store/useEditorStore.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// 캔버스에 배치된 컴포넌트의 노드 구조
export interface ComponentNode {
  id: string;
  type: 'ProductGrid' | 'CartSidebar' | 'OptionPicker' | 'PaymentButton' | 'Text' | 'Image';
  position: { x: number; y: number };
  size: { width: string; height: string }; // %, vw, vh 단위만 허용
  props: Record<string, any>;
  datasetBinding?: DatasetBinding; // 데이터셋 바인딩 정보
  actionChainId?: string; // 연결된 액션 체인 ID
}

export interface DatasetBinding {
  datasetId: string;          // 데이터셋 레지스트리 ID
  fieldMapping: Record<string, string>; // 컴포넌트 필드 -> 데이터셋 필드
}

interface EditorState {
  components: ComponentNode[];
  selectedComponentId: string | null;
  deviceSize: '15inch' | '24inch' | '32inch';
  
  // Actions
  addComponent: (node: ComponentNode) => void;
  updateComponent: (id: string, updates: Partial<ComponentNode>) => void;
  removeComponent: (id: string) => void;
  selectComponent: (id: string | null) => void;
  setDeviceSize: (size: '15inch' | '24inch' | '32inch') => void;
}

export const useEditorStore = create<EditorState>()(
  immer((set) => ({
    components: [],
    selectedComponentId: null,
    deviceSize: '24inch',
    
    addComponent: (node) => set((state) => {
      state.components.push(node);
    }),
    
    updateComponent: (id, updates) => set((state) => {
      const idx = state.components.findIndex(c => c.id === id);
      if (idx !== -1) {
        state.components[idx] = { ...state.components[idx], ...updates };
      }
    }),
    
    removeComponent: (id) => set((state) => {
      state.components = state.components.filter(c => c.id !== id);
    }),
    
    selectComponent: (id) => set((state) => {
      state.selectedComponentId = id;
    }),
    
    setDeviceSize: (size) => set((state) => {
      state.deviceSize = size;
    }),
  }))
);

// src/editor/store/useDatasetStore.ts
// 데이터셋 레지스트리: 커피 메뉴, 도서관 도서, 열차 시간표 등
export interface DatasetDefinition {
  id: string;
  tenantId: string;
  name: string;              // 예: "커피 메뉴", "도서 목록"
  sourceType: 'SQL' | 'API' | 'STATIC';
  schema: {                  // 데이터 구조 정의 (컴포넌트가 바인딩할 필드)
    fields: Array<{
      key: string;           // 예: "name", "price", "imageUrl"
      type: 'string' | 'number' | 'image' | 'boolean';
      label: string;         // UI 표시용 이름
    }>;
  };
  sampleData: any[];         // 에디터 미리보기용 샘플 데이터
}

interface DatasetState {
  datasets: DatasetDefinition[];
  loadDatasets: (tenantId: string) => Promise<void>;
}

export const useDatasetStore = create<DatasetState>((set) => ({
  datasets: [],
  loadDatasets: async (tenantId) => {
    const response = await fetch(`/api/v1/datasets?tenantId=${tenantId}`);
    const data = await response.json();
    set({ datasets: data });
  },
}));

3. 데이터셋 바인딩을 위한 드래그앤드롭 로직 (핵심)
// src/editor/panels/DatasetPanel.tsx
// 우측 패널: 데이터셋을 드래그하여 컴포넌트에 바인딩
import { useDrag } from 'react-dnd';
import { useDatasetStore } from '../store/useDatasetStore';

export const DatasetPanel: React.FC = () => {
  const { datasets } = useDatasetStore();
  
  return (
    <div className="p-4 bg-gray-50 border-l border-gray-200">
      <h3 className="font-bold text-lg mb-3">📊 데이터셋 레지스트리</h3>
      <div className="space-y-2">
        {datasets.map((dataset) => (
          <DraggableDatasetItem key={dataset.id} dataset={dataset} />
        ))}
      </div>
    </div>
  );
};

const DraggableDatasetItem: React.FC<{ dataset: DatasetDefinition }> = ({ dataset }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'DATASET',
    item: { datasetId: dataset.id, schema: dataset.schema },
    collect: (monitor) => ({ isDragging: !!monitor.isDragging() }),
  }));
  
  return (
    <div
      ref={drag}
      className={`p-3 bg-white rounded-lg border-2 cursor-grab ${
        isDragging ? 'opacity-50 border-blue-500' : 'border-gray-200 hover:border-blue-300'
      }`}
    >
      <div className="font-semibold">{dataset.name}</div>
      <div className="text-xs text-gray-500 mt-1">
        필드: {dataset.schema.fields.map(f => f.key).join(', ')}
      </div>
    </div>
  );
};

// src/editor/canvas/DroppableComponent.tsx
// 캔버스 위의 컴포넌트: 데이터셋을 드롭받아 바인딩
import { useDrop } from 'react-dnd';
import { useEditorStore, DatasetBinding } from '../store/useEditorStore';

export const DroppableComponent: React.FC<{ node: ComponentNode }> = ({ node }) => {
  const updateComponent = useEditorStore((s) => s.updateComponent);
  
  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'DATASET',
    drop: (item: { datasetId: string; schema: any }, monitor) => {
      // 데이터셋 필드와 컴포넌트 필드를 자동 매핑하는 로직
      const fieldMapping: Record<string, string> = {};
      item.schema.fields.forEach((field: any) => {
        // 간단한 휴리스틱: 필드 이름이 비슷하면 자동 매핑
        if (node.props.hasOwnProperty(field.key)) {
          fieldMapping[field.key] = field.key;
        }
      });
      
      const binding: DatasetBinding = {
        datasetId: item.datasetId,
        fieldMapping,
      };
      
      updateComponent(node.id, { datasetBinding: binding });
    },
    collect: (monitor) => ({ isOver: !!monitor.isOver() }),
  }));
  
  return (
    <div
      ref={drop}
      className={`relative ${isOver ? 'ring-4 ring-blue-400' : ''}`}
      style={{ /* position, size */ }}
    >
      {/* 컴포넌트 렌더링 */}
      {node.datasetBinding && (
        <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs px-2 py-1 rounded-bl">
          🔗 {node.datasetBinding.datasetId}
        </div>
      )}
    </div>
  );
};

4. 액션 체인 빌더 (시각적 노드 에디터)
// src/editor/panels/ActionChainBuilder.tsx
// 버튼 클릭 시 실행될 다중 단계 로직을 시각적으로 조립
import { useState } from 'react';
import { useActionStore, ActionNode, ActionType } from '../store/useActionStore';

const ACTION_TYPES: { type: ActionType; label: string; icon: string }[] = [
  { type: 'UPDATE_STATE', label: '상태 업데이트 (장바구니)', icon: '🛒' },
  { type: 'OPEN_MODAL', label: '모달 열기', icon: '🪟' },
  { type: 'CALL_API', label: 'API 호출 (결제 등)', icon: '🌐' },
  { type: 'WAIT_HARDWARE', label: '하드웨어 대기 (바코드/카드)', icon: '📡' },
  { type: 'EXECUTE_DRIVER', label: '하드웨어 드라이버 실행 (프린터)', icon: '🖨️' },
  { type: 'NAVIGATE', label: '페이지 이동', icon: '➡️' },
];

export const ActionChainBuilder: React.FC<{ componentId: string }> = ({ componentId }) => {
  const { chains, addNode, removeNode, updateNode } = useActionStore();
  const chain = chains[componentId] || { nodes: [] };
  
  return (
    <div className="p-4 bg-gray-900 text-white">
      <h3 className="font-bold text-lg mb-4">⚡ 액션 체인 빌더</h3>
      
      {/* 액션 타입 팔레트 */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {ACTION_TYPES.map((action) => (
          <button
            key={action.type}
            onClick={() => addNode(componentId, { type: action.type, config: {} })}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
          >
            {action.icon} {action.label}
          </button>
        ))}
      </div>
      
      {/* 노드 리스트 (순차적 실행 흐름) */}
      <div className="space-y-2">
        {chain.nodes.map((node, idx) => (
          <div key={node.id} className="flex items-center gap-2">
            <div className="text-gray-500 w-8">{idx + 1}.</div>
            <ActionNodeEditor
              node={node}
              onUpdate={(updates) => updateNode(componentId, node.id, updates)}
              onRemove={() => removeNode(componentId, node.id)}
            />
            {idx < chain.nodes.length - 1 && (
              <div className="text-blue-400">↓</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const ActionNodeEditor: React.FC<{
  node: ActionNode;
  onUpdate: (updates: Partial<ActionNode>) => void;
  onRemove: () => void;
}> = ({ node, onUpdate, onRemove }) => {
  return (
    <div className="flex-1 bg-gray-800 p-3 rounded-lg">
      <div className="flex justify-between items-center mb-2">
        <span className="font-semibold">{node.type}</span>
        <button onClick={onRemove} className="text-red-400 hover:text-red-300">✕</button>
      </div>
      
      {/* 노드 타입별 설정 UI */}
      {node.type === 'UPDATE_STATE' && (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="상태 키 (예: cart.items)"
            value={node.config.stateKey || ''}
            onChange={(e) => onUpdate({ config: { ...node.config, stateKey: e.target.value } })}
            className="w-full p-2 bg-gray-700 rounded"
          />
          <input
            type="text"
            placeholder="값 (예: selectedProduct)"
            value={node.config.value || ''}
            onChange={(e) => onUpdate({ config: { ...node.config, value: e.target.value } })}
            className="w-full p-2 bg-gray-700 rounded"
          />
        </div>
      )}
      
      {node.type === 'EXECUTE_DRIVER' && (
        <select
          value={node.config.driverId || ''}
          onChange={(e) => onUpdate({ config: { ...node.config, driverId: e.target.value } })}
          className="w-full p-2 bg-gray-700 rounded"
        >
          <option value="">-- 하드웨어 드라이버 선택 --</option>
          <option value="bixolon_srp350">Bixolon SRP-350 (실제)</option>
          <option value="mock_printer">교육용 프린터 시뮬레이터</option>
        </select>
      )}
      
      {node.type === 'WAIT_HARDWARE' && (
        <select
          value={node.config.hardwareType || ''}
          onChange={(e) => onUpdate({ config: { ...node.config, hardwareType: e.target.value } })}
          className="w-full p-2 bg-gray-700 rounded"
        >
          <option value="">-- 대기할 하드웨어 --</option>
          <option value="barcode_scanner">바코드 스캐너</option>
          <option value="card_reader">카드 리더</option>
          <option value="physical_button">물리 버튼 입력</option>
        </select>
      )}
    </div>
  );
};

5. 최종 JSON 스키마 직렬화 (서버로 전송될 템플릿 포맷)
// src/editor/serializers/templateSerializer.ts
import { useEditorStore } from '../store/useEditorStore';
import { useActionStore } from '../store/useActionStore';

export interface TemplateSchema {
  schemaVersion: '2.0';
  metadata: {
    name: string;
    tenantId: string;
    targetDevices: ('15inch' | '24inch' | '32inch')[];
    accessibilityValidated: boolean;
  };
  pages: Array<{
    id: string;
    name: string;
    components: Array<{
      id: string;
      type: string;
      position: { x: string; y: string }; // % 단위
      size: { width: string; height: string };
      props: Record<string, any>;
      datasetBinding?: {
        datasetId: string;
        fieldMapping: Record<string, string>;
      };
      actionChainId?: string;
    }>;
  }>;
  actionChains: Record<string, {
    nodes: Array<{
      id: string;
      type: string;
      config: Record<string, any>;
      onError?: { action: 'RETRY' | 'SKIP' | 'SHOW_MODAL'; config: any };
    }>;
  }>;
  globalState: {
    initialState: Record<string, any>; // 예: { cart: [], userSession: null }
  };
}

export const serializeTemplate = (): TemplateSchema => {
  const { components, deviceSize } = useEditorStore.getState();
  const { chains } = useActionStore.getState();
  
  return {
    schemaVersion: '2.0',
    metadata: {
      name: '커피 주문 키오스크 템플릿',
      tenantId: 'tenant_abc123',
      targetDevices: ['15inch', '24inch', '32inch'],
      accessibilityValidated: true, // 접근성 검증 통과 시 true
    },
    pages: [
      {
        id: 'page_main',
        name: '메인 메뉴',
        components: components.map((c) => ({
          id: c.id,
          type: c.type,
          position: { x: `${c.position.x}%`, y: `${c.position.y}%` },
          size: c.size,
          props: c.props,
          datasetBinding: c.datasetBinding,
          actionChainId: c.actionChainId,
        })),
      },
    ],
    actionChains: chains,
    globalState: {
      initialState: {
        cart: [],
        selectedProduct: null,
        userSession: null,
      },
    },
  };
};

// 게시(Publish) 버튼 클릭 시 호출
export const publishTemplate = async () => {
  const schema = serializeTemplate();
  
  // 1. 접근성 자동 검증 게이트
  const validation = await validateAccessibility(schema);
  if (!validation.passed) {
    alert(`게시 차단: ${validation.errors.join(', ')}`);
    return;
  }
  
  // 2. 서버로 전송
  const response = await fetch('/api/v1/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(schema),
  });
  
  if (response.ok) {
    alert('✅ 템플릿이 모든 기기에 배포되었습니다.');
  }
};

// 접근성 검증 로직 (예시)
const validateAccessibility = async (schema: TemplateSchema): Promise<{ passed: boolean; errors: string[] }> => {
  const errors: string[] = [];
  
  schema.pages.forEach((page) => {
    page.components.forEach((comp) => {
      // 버튼 크기 검증 (최소 64x64px 상당)
      if (comp.type.includes('Button') || comp.type === 'ProductCard') {
        // % 단위를 실제 픽셀로 환산하여 검증 (24인치 기준)
        const widthPx = parseFloat(comp.size.width) * 1920 / 100;
        const heightPx = parseFloat(comp.size.height) * 1080 / 100;
        if (widthPx < 64 || heightPx < 64) {
          errors.push(`컴포넌트 ${comp.id}: 터치 타겟이 64px 미만입니다.`);
        }
      }
      
      // TTS 안내 텍스트 존재 여부 검증
      if (comp.type.includes('Button') && !comp.props.ttsLabel) {
        errors.push(`컴포넌트 ${comp.id}: 음성 안내(TTS) 텍스트가 없습니다.`);
      }
    });
  });
  
  return { passed: errors.length === 0, errors };
};

6. 실제 동작 시나리오: 커피 주문 키오스크 클론
관리자가 이 에디터로 "스타벅스wind 커피 주문 키오스크"를 만드는 흐름:
컴포넌트 배치: 좌측 팔레트에서 ProductGrid, CartSidebar, PaymentButton를 캔버스에 드래그.
데이터셋 바인딩: 우측 DatasetPanel에서 "커피 메뉴 데이터셋"을 ProductGrid에 드롭 → 자동으로 name, price, imageUrl 필드 매핑.
액션 체인 구성: PaymentButton을 선택하고 하단 액션 체인 빌더에서:
노드 1: CALL_API (결제 서버 호출)
노드 2: WAIT_HARDWARE (카드 리더 대기)
노드 3: EXECUTE_DRIVER (Bixolon 프린터로 영수증 출력)
노드 4: UPDATE_STATE (장바구니 비우기)
노드 5: NAVIGATE (완료 화면으로 이동)
디바이스 프리뷰: 상단 토글로 15/24/32인치 화면에서 레이아웃이 어떻게 반응형으로 재배치되는지 확인.
게시: [배포] 버튼 클릭 → 접근성 자동 검증 통과 → 모든 기기에 실시간 반영.

1.3 핵심 모듈 상세 설계
1.3.1 Dynamic Dataset Resolver (동적 데이터셋 해석기)
// src/engine/dataset/resolver.rs
use async_trait::async_trait;
use serde_json::Value;
use sqlx::{PgPool, Row};
use std::collections::HashMap;

// 데이터 소스 타입별 해석기 트레이트
#[async_trait]
pub trait DataSourceInterpreter: Send + Sync {
    async fn resolve(
        &self,
        dataset_id: &str,
        params: &HashMap<String, Value>,
        tenant_id: &str,
    ) -> Result<Vec<Value>, DatasetError>;
}

// SQL 기반 데이터 소스 해석기
pub struct SqlInterpreter {
    pool: PgPool,
}

#[async_trait]
impl DataSourceInterpreter for SqlInterpreter {
    async fn resolve(
        &self,
        dataset_id: &str,
        params: &HashMap<String, Value>,
        tenant_id: &str,
    ) -> Result<Vec<Value>, DatasetError> {
        // 1. 데이터셋 메타데이터 조회 (파라미터화된 쿼리 템플릿)
        let dataset = sqlx::query_as::<_, DatasetMeta>(
            "SELECT query_template, schema_def FROM tenant_datasets WHERE id = $1 AND tenant_id = $2"
        )
        .bind(dataset_id)
        .bind(tenant_id)
        .fetch_one(&self.pool)
        .await?;
        
        // 2. SQL 인젝션 방지를 위해 파라미터 바인딩만 허용 (Raw SQL 실행 금지)
        let mut query = sqlx::query(&dataset.query_template);
        for (key, value) in params {
            query = query.bind(value.to_string());
        }
        
        // 3. 실행 및 JSON 변환
        let rows = query.fetch_all(&self.pool).await?;
        let results: Vec<Value> = rows
            .iter()
            .map(|row| row_to_json(row, &dataset.schema_def))
            .collect();
        
        Ok(results)
    }
}

// 외부 API 기반 데이터 소스 해석기
pub struct ApiInterpreter {
    client: reqwest::Client,
}

#[async_trait]
impl DataSourceInterpreter for ApiInterpreter {
    async fn resolve(
        &self,
        dataset_id: &str,
        params: &HashMap<String, Value>,
        tenant_id: &str,
    ) -> Result<Vec<Value>, DatasetError> {
        // API 엔드포인트, 헤더, 인증 정보를 데이터셋 메타에서 동적 로드
        // CORS 및 프록시 처리 포함
        todo!()
    }
}

// 레지스트리 패턴: 데이터 소스 타입에 따라 해석기 동적 선택
pub struct DatasetResolver {
    interpreters: HashMap<String, Box<dyn DataSourceInterpreter>>,
}

impl DatasetResolver {
    pub async fn resolve_dataset(
        &self,
        dataset_id: &str,
        params: HashMap<String, Value>,
        tenant_id: &str,
    ) -> Result<Vec<Value>, DatasetError> {
        let meta = self.get_dataset_meta(dataset_id, tenant_id).await?;
        let interpreter = self.interpreters
            .get(&meta.source_type)
            .ok_or(DatasetError::UnsupportedSourceType)?;
        
        interpreter.resolve(dataset_id, &params, tenant_id).await
    }
}

1.3.2 Server-Side Action Executor (서버 측 액션 실행기)
// src/engine/action/executor.rs
// 복잡한 비즈니스 로직을 트랜잭션으로 실행 (예: 재고차감 + 결제승인 + 포인트적립)

pub struct ActionExecutor {
    pool: PgPool,
    hardware_registry: HardwareRegistry,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionChain {
    pub id: String,
    pub nodes: Vec<ActionNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionNode {
    pub id: String,
    pub action_type: ActionType,
    pub config: Value,
    pub on_error: Option<ErrorPolicy>, // RETRY, SKIP, ROLLBACK
}

pub enum ActionType {
    UpdateState,
    CallApi,
    ExecuteDriver,
    DatabaseTransaction, // SQL 실행 (재고 차감 등)
    WaitHardware,
}

impl ActionExecutor {
    pub async fn execute_chain(
        &self,
        chain: &ActionChain,
        context: &mut ActionContext,
    ) -> Result<ActionResult, ActionError> {
        // 전체 체인을 하나의 DB 트랜잭션으로 감싸기 (Atomic)
        let mut tx = self.pool.begin().await?;
        
        for node in &chain.nodes {
            match self.execute_node(node, context, &mut tx).await {
                Ok(_) => continue,
                Err(e) => {
                    // 에러 정책 처리
                    match node.on_error {
                        Some(ErrorPolicy::Retry { max_attempts }) => {
                            // 재시도 로직
                        }
                        Some(ErrorPolicy::Skip) => continue,
                        Some(ErrorPolicy::Rollback) | None => {
                            tx.rollback().await?;
                            return Err(e);
                        }
                    }
                }
            }
        }
        
        tx.commit().await?;
        Ok(ActionResult::Success(context.snapshot()))
    }
    
    async fn execute_node(
        &self,
        node: &ActionNode,
        context: &mut ActionContext,
        tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<(), ActionError> {
        match node.action_type {
            ActionType::DatabaseTransaction => {
                // 파라미터화된 SQL 실행 (재고 차감, 포인트 적립 등)
                let sql = node.config["sql"].as_str().unwrap();
                sqlx::query(sql)
                    .bind(context.get_param("product_id")?)
                    .execute(&mut **tx)
                    .await?;
            }
            ActionType::ExecuteDriver => {
                let driver_id = node.config["driver_id"].as_str().unwrap();
                // 하드웨어 레지스트리에서 드라이버 조회 후 실행 명령을 키오스크로 푸시
                self.hardware_registry
                    .push_command_to_device(context.device_id(), driver_id, &node.config)
                    .await?;
            }
            _ => { /* 다른 액션 타입 처리 */ }
        }
        Ok(())
    }
}

1.3.3 Analytics Aggregator (통계 집계 엔진)

// src/engine/analytics/aggregator.rs
// 키오스크에서 수집된 수행 이벤트 및 설문 응답을 실시간 집계

pub struct AnalyticsAggregator {
    pool: PgPool,
    redis: RedisPool,
}

impl AnalyticsAggregator {
    // 실시간 집계 (Redis 활용)
    pub async fn record_event(&self, event: AnalyticsEvent) -> Result<()> {
        // Redis에 실시간 카운터 증가
        let key = format!(
            "analytics:{}:{}:{}",
            event.tenant_id,
            event.device_id,
            event.event_type
        );
        self.redis.incr(&key, 1).await?;
        
        // PostgreSQL에 원본 저장 (시간 파티셔닝)
        sqlx::query(
            "INSERT INTO analytics_events (tenant_id, device_id, event_type, payload, created_at) VALUES ($1, $2, $3, $4, NOW())"
        )
        .bind(&event.tenant_id)
        .bind(&event.device_id)
        .bind(&event.event_type)
        .bind(&event.payload)
        .execute(&self.pool)
        .await?;
        
        Ok(())
    }
    
    // 대시보드용 집계 데이터 조회 (Materialized View 활용)
    pub async fn get_dashboard_stats(
        &self,
        tenant_id: &str,
        period: &DateRange,
    ) -> Result<DashboardStats> {
        // 설문 만족도, 앱 수행 완료율, 오류율 등을 한 번의 쿼리로 집계
        let stats = sqlx::query_as::<_, DashboardStats>(
            "SELECT * FROM dashboard_stats_mv WHERE tenant_id = $1 AND period @> $2"
        )
        .bind(tenant_id)
        .bind(period)
        .fetch_one(&self.pool)
        .await?;
        
        Ok(stats)
    }
}
1.4 확장 포인트
새로운 데이터 소스 타입 추가: DataSourceInterpreter 트레이트만 구현하면 GraphQL, gRPC, 블록체인 등 어떤 소스도 동적 추가 가능
새로운 액션 타입 추가: ActionType enum에 추가하고 execute_node에 분기 추가
통계 지표 확장: Materialized View 정의를 추가하면 대시보드에 즉시 반영
1.5 리스크 및 대응
리스크
영향도
대응 방안
동적 SQL 실행 시 인젝션
치명적
파라미터화된 쿼리만 허용, Raw SQL 입력 UI 차단
대용량 이벤트 수집 시 DB 부하
높음
시간 파티셔닝 + Redis 버퍼링 + 배치 INSERT
멀티테넌트 데이터 누수
치명적
RLS(Row-Level Security) + 미들웨어 강제 tenant_id 주입

