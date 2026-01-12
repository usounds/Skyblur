import { Loading } from "./Loading";

export function PageLoading() {
    return (
        <div style={{ minHeight: '72vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Loading />
        </div>
    );
}

export default PageLoading;
